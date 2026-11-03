import { NextRequest, NextResponse } from "next/server";
import { getSummaryTeaser, getSummaryFull, getSummaryRaw } from "@/lib/db";
import { FreeContent, PremiumContent } from "@/lib/types";

function normalizePremiumContent(paidText: string): PremiumContent | null {
  if (!paidText) return null;
  try {
    const parsed = JSON.parse(paidText);

    // If already in the unified ChatRoast format:
    if (parsed.secondary_user_profile && parsed.toxic_traits) {
      return parsed as PremiumContent;
    }

    // Fallback if stored under previous ChatWrapped structure
    const secProfile = parsed.profiles?.[1] || parsed.profiles?.[0] || {
      name: "המשתתף השני",
      title: "שר הסינון ומנכ״ל אגף ה-V הכחולים",
      roast: "אמן ההיעלמות הדיגיטלית. צופה בכל ההודעות אבל בוחר להגיב רק כשיש לו מה להרוויח.",
    };

    const toxicTraits =
      Array.isArray(parsed.rulebook) && parsed.rulebook.length > 0
        ? parsed.rulebook.map((r: any) => ({
            trait_name: r.title,
            explanation: r.description,
          }))
        : [
            {
              trait_name: "תסמונת ה-V הכחולים והסינון המאורגן",
              explanation: "הודעות נקראות באופן מיידי אך זוכות למענה רק כעבור שעות רבות של שתיקה רועמת.",
            },
            {
              trait_name: "תכנון מגלומני של אירועים שלעולם לא יקרו",
              explanation: "שעות של שיחות והתלבטויות על מקום מפגש, שמסתיימות באפס יציאות בפועל.",
            },
          ];

    const theUnspokenTruth =
      parsed.dramaMoment?.story ||
      parsed.conclusion ||
      "מה שאף אחד לא מעז לומר בצ'אט הזה הוא שכולם מרגישים שהם משקיעים יותר מהאחרים, אבל אף אחד לא יעז לפתוח את זה באמת.";

    const finalVerdict =
      Array.isArray(parsed.forecast2035) && parsed.forecast2035.length > 0
        ? parsed.forecast2035.map((f: any) => `${f.name}: ${f.prediction}`).join("\n\n")
        : parsed.conclusion ||
          "בעוד חמש שנים אתם עדיין תתלבטו איפה לאכול, תשלחו סטיקרים במקום לענות ישירות, ותמשיכו לתחזק את הצ'אט הכאוטי הזה.";

    return {
      secondary_user_profile: {
        user_name: secProfile.name,
        roast_title: secProfile.title || "שר הסינון ומנכ״ל ה-V הכחול",
        psychological_analysis: secProfile.roast || "",
      },
      toxic_traits: toxicTraits,
      the_unspoken_truth: theUnspokenTruth,
      final_verdict: finalVerdict,
    };
  } catch (e) {
    return null;
  }
}

function normalizeFreeContent(teaserData: any, rawRecord?: any): FreeContent | null {
  // 1. Direct free_content
  if (teaserData.free_content) {
    const fc = teaserData.free_content;
    const quotes = Array.isArray(fc.dynamic_analysis?.proof_quotes)
      ? fc.dynamic_analysis.proof_quotes
      : fc.dynamic_analysis?.proof_quote
      ? [
          {
            sender: fc.dynamic_analysis.proof_quote.sender_name || fc.dynamic_analysis.proof_quote.sender || "",
            context: fc.dynamic_analysis.proof_quote.timestamp || fc.dynamic_analysis.proof_quote.context || "",
            text: fc.dynamic_analysis.proof_quote.message_text || fc.dynamic_analysis.proof_quote.text || "",
          },
        ]
      : [];

    return {
      headline: fc.headline || teaserData.title || "דוח חקירה סאטירי",
      opening_intro: fc.opening_intro || teaserData.intro || "",
      dynamic_analysis: {
        section_title: fc.dynamic_analysis?.section_title || "החמ\"ל של הקבוצה",
        intro_text: fc.dynamic_analysis?.intro_text || "",
        proof_quotes: quotes,
        punchline_text: fc.dynamic_analysis?.punchline_text || "",
      },
      primary_user_profile: {
        user_name: fc.primary_user_profile?.user_name || "המשתמש המוביל",
        roast_title: fc.primary_user_profile?.roast_title || "מנכ״ל משרד החפירות",
        psychological_analysis: fc.primary_user_profile?.psychological_analysis || "",
      },
    };
  }

  // 2. freeTeaser (previous naming)
  if (teaserData.freeTeaser) {
    const ft = teaserData.freeTeaser;
    const quotes = Array.isArray(ft.dynamic_analysis?.proof_quotes)
      ? ft.dynamic_analysis.proof_quotes
      : ft.dynamic_analysis?.proof_quote
      ? [
          {
            sender: ft.dynamic_analysis.proof_quote.sender_name || ft.dynamic_analysis.proof_quote.sender || "",
            context: ft.dynamic_analysis.proof_quote.timestamp || ft.dynamic_analysis.proof_quote.context || "",
            text: ft.dynamic_analysis.proof_quote.message_text || ft.dynamic_analysis.proof_quote.text || "",
          },
        ]
      : [];

    return {
      headline: ft.headline || teaserData.title || "דוח חקירה סאטירי",
      opening_intro: ft.opening_intro || teaserData.intro || "",
      dynamic_analysis: {
        section_title: ft.dynamic_analysis?.section_title || "הדינמיקה הקבוצתית",
        intro_text: ft.dynamic_analysis?.intro_text || "",
        proof_quotes: quotes,
        punchline_text: ft.dynamic_analysis?.punchline_text || "",
      },
      primary_user_profile: {
        user_name: ft.primary_user_profile?.user_name || "המשתמש המוביל",
        roast_title: ft.primary_user_profile?.roast_title || "מנכ״ל משרד הדמיון המודרך",
        psychological_analysis: ft.primary_user_profile?.psychological_analysis || "",
      },
    };
  }

  // 3. Fallback for earliest records from paid_text or stats
  if (rawRecord?.paid_text) {
    try {
      const paid = JSON.parse(rawRecord.paid_text);
      if (paid.profiles && paid.profiles.length > 0) {
        const p1 = paid.profiles[0];
        const second = paid.profiles[1]?.name || "החברים";
        return {
          headline: paid.headline || rawRecord.title,
          opening_intro: paid.intro || rawRecord.title,
          dynamic_analysis: {
            section_title: paid.dramaMoment?.title || `הדינמיקה בין ${p1.name} ל-${second}`,
            intro_text: paid.dramaMoment?.story || "דפוס תקשורת אינטנסיבי שמאופיין בהודעות בשעות לא הגיוניות.",
            proof_quotes: paid.dramaMoment?.keyQuote
              ? [
                  {
                    sender: paid.dramaMoment.keySender || p1.name,
                    context: "רגע שיא",
                    text: paid.dramaMoment.keyQuote,
                  },
                ]
              : p1.quote
              ? [
                  {
                    sender: p1.name,
                    context: p1.quoteTime || "",
                    text: p1.quote,
                  },
                ]
              : [],
            punchline_text: "זה בדיוק המשפט שמסכם את כל מה ששבור ונפלא בדינמיקה הזו.",
          },
          primary_user_profile: {
            user_name: p1.name,
            roast_title: p1.title || "מנכ״ל משרד החפירות",
            psychological_analysis: p1.roast || "",
          },
        };
      }
    } catch (e) {}
  }

  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    const sessionId = searchParams.get("session_id");

    if (!id) {
      return NextResponse.json({ error: "מזהה סיכום חסר" }, { status: 400 });
    }

    // 1. If an access_token was provided: user is requesting FULL content
    if (token) {
      const fullRecord = getSummaryFull(id, token);
      if (!fullRecord) {
        const raw = getSummaryRaw(id);
        if (!raw) {
          return NextResponse.json({ error: "הדוח לא נמצא" }, { status: 404 });
        }

        return NextResponse.json(
          {
            error: "גישה נדחתה: אסימון לא תואם או שהדוח עדיין לא שולם.",
            paid: Boolean(raw.paid),
          },
          { status: 403 }
        );
      }

      let teaserData: any = {};
      try {
        teaserData = JSON.parse(fullRecord.free_text);
      } catch (e) {
        teaserData = {};
      }

      const parsedPremium = normalizePremiumContent(fullRecord.paid_text);

      const freeContent = normalizeFreeContent(teaserData, fullRecord);

      return NextResponse.json({
        id: fullRecord.id,
        title: fullRecord.title,
        intro: freeContent?.opening_intro || teaserData.intro || fullRecord.title,
        analysis_metadata: teaserData.analysis_metadata || null,
        free_content: freeContent,
        paywall_teasers: teaserData.paywall_teasers || teaserData.freeTeaser?.paywall_teasers || [],
        stats: teaserData.stats || null,
        premium_content: parsedPremium,
        paid: true,
        created_at: fullRecord.created_at,
        paid_at: fullRecord.paid_at,
        token: fullRecord.access_token,
      });
    }

    // 2. If session_id was provided (user returning from Stripe Checkout):
    if (sessionId) {
      const raw = getSummaryRaw(id);
      if (!raw) {
        return NextResponse.json({ error: "הדוח לא נמצא" }, { status: 404 });
      }

      if (raw.paid && raw.stripe_session_id === sessionId) {
        let teaserData: any = {};
        try {
          teaserData = JSON.parse(raw.free_text);
        } catch (e) {
          teaserData = {};
        }

        const parsedPremium = normalizePremiumContent(raw.paid_text);

        const freeContent = normalizeFreeContent(teaserData, raw);

        return NextResponse.json({
          id: raw.id,
          title: raw.title,
          intro: freeContent?.opening_intro || teaserData.intro || raw.title,
          analysis_metadata: teaserData.analysis_metadata || null,
          free_content: freeContent,
          paywall_teasers: teaserData.paywall_teasers || teaserData.freeTeaser?.paywall_teasers || [],
          stats: teaserData.stats || null,
          premium_content: parsedPremium,
          paid: true,
          created_at: raw.created_at,
          paid_at: raw.paid_at,
          token: raw.access_token,
        });
      }

      return NextResponse.json({
        id: raw.id,
        title: raw.title,
        paid: false,
        pendingWebhook: true,
      });
    }

    // 3. Otherwise: return public teaser metadata ONLY
    const teaser = getSummaryTeaser(id);
    if (!teaser) {
      return NextResponse.json({ error: "הדוח לא נמצא" }, { status: 404 });
    }

    let teaserData: any = {};
    try {
      teaserData = JSON.parse(teaser.free_text);
    } catch (e) {
      teaserData = { intro: teaser.free_text, stats: null };
    }

    const raw = getSummaryRaw(id);
    const freeContent = normalizeFreeContent(teaserData, raw);

    // If report has already been paid, return the full premium content automatically!
    if (raw && raw.paid) {
      const parsedPremium = normalizePremiumContent(raw.paid_text);
      return NextResponse.json({
        id: teaser.id,
        title: teaser.title,
        intro: freeContent?.opening_intro || teaserData.intro || teaser.free_text,
        analysis_metadata: teaserData.analysis_metadata || null,
        free_content: freeContent,
        paywall_teasers: teaserData.paywall_teasers || teaserData.freeTeaser?.paywall_teasers || [],
        stats: teaserData.stats || null,
        premium_content: parsedPremium,
        paid: true,
        created_at: teaser.created_at,
        paid_at: raw.paid_at,
        token: raw.access_token,
      });
    }

    return NextResponse.json({
      id: teaser.id,
      title: teaser.title,
      intro: freeContent?.opening_intro || teaserData.intro || teaser.free_text,
      analysis_metadata: teaserData.analysis_metadata || null,
      free_content: freeContent,
      paywall_teasers: teaserData.paywall_teasers || teaserData.freeTeaser?.paywall_teasers || [],
      stats: teaserData.stats || null,
      paid: false,
      created_at: teaser.created_at,
    });
  } catch (error: any) {
    console.error("[API Summary Detail] Error:", error);
    return NextResponse.json({ error: error.message || "שגיאה בטעינת הדוח" }, { status: 500 });
  }
}
