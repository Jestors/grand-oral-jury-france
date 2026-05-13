export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { session_id } = req.query;
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeKey || !session_id) {
    return res.status(400).json({ paid: false });
  }

  try {
    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${session_id}`, {
      headers: { "Authorization": `Bearer ${stripeKey}` },
    });

    const session = await response.json();

    if (session.payment_status === "paid") {
      return res.status(200).json({ paid: true });
    }

    return res.status(200).json({ paid: false });
  } catch (e) {
    return res.status(500).json({ paid: false, error: e.message });
  }
}
