import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { updateSummaryPaid, getSummaryByStripeSessionId } from "@/lib/db";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret || !stripe) {
    return NextResponse.json(
      { error: "Webhook signature or Stripe secret not configured" },
      { status: 400 }
    );
  }

  try {
    const rawBody = await req.text();
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret
    );

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any;
      const summaryId = session.metadata?.summary_id;
      const sessionId = session.id;

      if (summaryId) {
        updateSummaryPaid(summaryId, sessionId);
        console.log(`[Stripe Webhook] Payment verified for summary ${summaryId}`);
      } else {
        const found = getSummaryByStripeSessionId(sessionId);
        if (found) {
          updateSummaryPaid(found.id, sessionId);
          console.log(`[Stripe Webhook] Payment verified by session ID for summary ${found.id}`);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("[Stripe Webhook] Verification error:", err.message);
    return NextResponse.json(
      { error: `Webhook error: ${err.message}` },
      { status: 400 }
    );
  }
}
