import { NextRequest, NextResponse } from "next/server";
import { getSummaryTeaser, getSummaryFull, getSummaryRaw } from "@/lib/db";

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

      let parsedPremium: any = null;
      try {
        parsedPremium = JSON.parse(fullRecord.paid_text);
      } catch (e) {
        parsedPremium = null;
      }

      return NextResponse.json({
        id: fullRecord.id,
        title: fullRecord.title,
        intro: teaserData.intro || fullRecord.title,
        analysis_metadata: teaserData.analysis_metadata || null,
        free_content: teaserData.free_content || null,
        paywall_teasers: teaserData.paywall_teasers || [],
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

        let parsedPremium: any = null;
        try {
          parsedPremium = JSON.parse(raw.paid_text);
        } catch (e) {
          parsedPremium = null;
        }

        return NextResponse.json({
          id: raw.id,
          title: raw.title,
          intro: teaserData.intro || raw.title,
          analysis_metadata: teaserData.analysis_metadata || null,
          free_content: teaserData.free_content || null,
          paywall_teasers: teaserData.paywall_teasers || [],
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

    return NextResponse.json({
      id: teaser.id,
      title: teaser.title,
      intro: teaserData.intro || teaser.free_text,
      analysis_metadata: teaserData.analysis_metadata || null,
      free_content: teaserData.free_content || null,
      paywall_teasers: teaserData.paywall_teasers || [],
      stats: teaserData.stats || null,
      paid: teaser.paid,
      created_at: teaser.created_at,
    });
  } catch (error: any) {
    console.error("[API Summary Detail] Error:", error);
    return NextResponse.json({ error: error.message || "שגיאה בטעינת הדוח" }, { status: 500 });
  }
}
