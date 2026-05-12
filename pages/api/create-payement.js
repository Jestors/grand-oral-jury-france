export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const priceId   = process.env.STRIPE_PRICE_ID;
  const baseUrl   = process.env.NEXT_PUBLIC_BASE_URL || "https://grand-oral-jury-france.vercel.app";

  if (!stripeKey || !priceId) {
    return res.status(500).json({ error: "Stripe non configuré" });
  }

  try {
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "payment_method_types[]": "card",
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        "mode": "payment",
        "success_url": `${baseUrl}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        "cancel_url": `${baseUrl}/?payment=cancel`,
        "locale": "fr",
      }),
    });

    const session = await response.json();

    if (session.error) {
      return res.status(500).json({ error: session.error.message });
    }

    return res.status(200).json({ url: session.url });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
