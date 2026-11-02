import { NextRequest, NextResponse } from "next/server";
import { getSummaryRaw, updateStripeSessionId } from "@/lib/db";
import { createCheckoutSession } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "מזהה סיכום חסר או לא תקין" },
        { status: 400 }
      );
    }

    const summary = getSummaryRaw(id);
    if (!summary) {
      return NextResponse.json(
        { error: "הסיכום המבוקש לא נמצא" },
        { status: 404 }
      );
    }

    // If already paid, return status
    if (summary.paid) {
      return NextResponse.json({
        alreadyPaid: true,
        redirectUrl: `/summary/${id}?token=${summary.access_token}`,
      });
    }

    const origin =
      req.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const { url, sessionId, isSimulated } = await createCheckoutSession(
      summary.id,
      summary.title,
      origin
    );

    // Save stripe_session_id for idempotency and verification (PRD 6.5 & 13)
    updateStripeSessionId(summary.id, sessionId);

    return NextResponse.json({
      url,
      sessionId,
      isSimulated,
    });
  } catch (error: any) {
    console.error("[API Checkout] Error:", error);
    return NextResponse.json(
      { error: error.message || "שגיאה ביצירת תהליך התשלום" },
      { status: 500 }
    );
  }
}
