export default async function handler(req, res) {
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  const { session_id, email } = req.query;
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeKey || !session_id)
    return res.status(400).json({ paid: false });

  try {
    // 1. Verify payment with Stripe
    const stripeRes = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${session_id}`,
      { headers: { Authorization: `Bearer ${stripeKey}` } }
    );
    const session = await stripeRes.json();

    if (session.payment_status !== "paid")
      return res.status(200).json({ paid: false });

    // 2. If email provided, mark user as paid in Supabase
    if (email) {
      const supabaseUrl = process.env.SUPABASE_URL || process.env.URL_SUPABASE;
      const supabaseKey = process.env.SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseKey) {
        const normalizedEmail = email.toLowerCase().trim();

        await fetch(
          `${supabaseUrl}/rest/v1/users_email?email=eq.${encodeURIComponent(normalizedEmail)}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              is_paid: true,
              stripe_session_id: session_id,
            }),
          }
        );
      }
    }

    return res.status(200).json({ paid: true });
  } catch (e) {
    return res.status(500).json({ paid: false, error: e.message });
  }
}
