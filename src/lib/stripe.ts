import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2025-02-24.acacia" as any,
    })
  : null;

export interface CreateCheckoutResult {
  url: string;
  sessionId: string;
  isSimulated: boolean;
}

export async function createCheckoutSession(
  summaryId: string,
  summaryTitle: string,
  origin: string
): Promise<CreateCheckoutResult> {
  const priceILS = parseInt(process.env.ARTICLE_PRICE_ILS || "20", 10);

  // If Stripe is not configured or in local dev without keys, provide simulation
  if (!stripe || !stripeSecretKey || stripeSecretKey.trim() === "" || stripeSecretKey.startsWith("sk_test_placeholder")) {
    const mockSessionId = `sim_session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const returnUrl = `${origin}/summary/${summaryId}?simulate_payment=true&session_id=${mockSessionId}`;
    return {
      url: returnUrl,
      sessionId: mockSessionId,
      isSimulated: true,
    };
  }

  // Real Stripe Checkout Session creation
  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price_data: {
          currency: "ils",
          product_data: {
            name: `סיכום צ'אט מלא: ${summaryTitle.slice(0, 50)}`,
            description: "קריאה מלאה של הכתבה והניתוח ההומוריסטי",
          },
          unit_amount: priceILS * 100, // 2000 agorot = 20 ILS
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    metadata: {
      summary_id: summaryId,
    },
    success_url: `${origin}/summary/${summaryId}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/summary/${summaryId}?canceled=true`,
  });

  if (!session.url) {
    throw new Error("נכשלה יצירת קישור התשלום ב-Stripe");
  }

  return {
    url: session.url,
    sessionId: session.id,
    isSimulated: false,
  };
}
