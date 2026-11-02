import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { preprocessChatText } from "@/lib/preprocess";
import { parseChatHistory } from "@/lib/parser";
import { generateChatRoastReport } from "@/lib/ai";
import { createSummaryRecord } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";
import { ChatContext } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    // 1. IP Rate Limiting
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";

    const rateLimit = checkRateLimit(ip);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `הגעת למגבלת הבקשות (5 בקשות לשעה). אנא נסה שוב בעוד ${rateLimit.resetInSeconds} שניות.`,
        },
        { status: 429 }
      );
    }

    // 2. Extract content from FormData or JSON body
    let rawText = "";
    let context: ChatContext = "friends";
    let nameMapping: Record<string, string> | undefined;
    let userParticipant: string | undefined;
    let email: string | undefined;

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json({ error: "לא נבחר קובץ להעלאה" }, { status: 400 });
      }

      if (!file.name.toLowerCase().endsWith(".txt")) {
        return NextResponse.json(
          { error: "יש להעלות קובץ בפורמט .txt בלבד (ייצוא צ'אט מוואטסאפ או טלגרם)" },
          { status: 400 }
        );
      }

      const MAX_SIZE = 5 * 1024 * 1024; // 5MB
      if (file.size > MAX_SIZE) {
        return NextResponse.json({ error: "גודל הקובץ עולה על 5MB המותרים" }, { status: 400 });
      }

      rawText = await file.text();

      const ctx = formData.get("context") as string | null;
      if (ctx) context = ctx as ChatContext;

      const mappingRaw = formData.get("nameMapping") as string | null;
      if (mappingRaw) {
        try {
          nameMapping = JSON.parse(mappingRaw);
        } catch (e) {}
      }

      const userP = formData.get("userParticipant") as string | null;
      if (userP) userParticipant = userP;

      const userEmail = formData.get("email") as string | null;
      if (userEmail) email = userEmail;
    } else {
      const body = await req.json();
      rawText = body.text || "";
      if (body.context) context = body.context;
      nameMapping = body.nameMapping;
      userParticipant = body.userParticipant;
      email = body.email;
    }

    if (!rawText || rawText.trim().length === 0) {
      return NextResponse.json({ error: "תוכן הצ'אט ריק" }, { status: 400 });
    }

    // 3. Preprocess chat text (phone numbers redaction & security)
    let preprocessed;
    try {
      preprocessed = preprocessChatText(rawText);
    } catch (err: any) {
      return NextResponse.json({ error: err.message || "שגיאה בעיבוד הקובץ" }, { status: 400 });
    }

    // 4. Advanced NLP scanning & parsing
    const chatAnalysis = parseChatHistory(
      preprocessed.cleanedText,
      nameMapping,
      userParticipant
    );

    if (chatAnalysis.participants.length === 0) {
      return NextResponse.json(
        { error: "לא זוהו משתתפים בשיחה. ודאו שהקובץ הוא ייצוא צ'אט תקין." },
        { status: 400 }
      );
    }

    // 5. Generate unified Chat Roast report with AI (Single Call)
    const report = await generateChatRoastReport(
      chatAnalysis.participants,
      context,
      userParticipant,
      chatAnalysis.totalMessages,
      chatAnalysis.messages
    );

    // 6. Generate UUID & Access Token
    const id = uuidv4();
    const accessToken = crypto.randomBytes(24).toString("hex");

    const statsData = {
      totalMessages: chatAnalysis.totalMessages,
      participants: chatAnalysis.participants,
    };

    // Free teaser payload stored in DB
    const teaserPayload = JSON.stringify({
      id,
      title: report.free_content.headline,
      intro: report.free_content.opening_intro,
      analysis_metadata: report.analysis_metadata,
      free_content: report.free_content,
      paywall_teasers: report.paywall_teasers,
      stats: statsData,
    });

    // Premium payload (Protected behind Paywall)
    const premiumPayload = JSON.stringify(report.premium_content);

    // 7. Store summary in DB
    createSummaryRecord({
      id,
      access_token: accessToken,
      title: report.free_content.headline,
      free_text: teaserPayload,
      paid_text: premiumPayload,
    });

    // 8. Return response: strictly free content + paywall teasers + stats
    return NextResponse.json({
      id,
      title: report.free_content.headline,
      intro: report.free_content.opening_intro,
      analysis_metadata: report.analysis_metadata,
      free_content: report.free_content,
      paywall_teasers: report.paywall_teasers,
      stats: statsData,
      participants: chatAnalysis.participants,
      totalMessages: chatAnalysis.totalMessages,
    });
  } catch (error: any) {
    console.error("[API Summarize Chat Roast] Error:", error);
    return NextResponse.json(
      { error: error.message || "שגיאה בניתוח הצ'אט. אנא נסה שוב." },
      { status: 500 }
    );
  }
}
