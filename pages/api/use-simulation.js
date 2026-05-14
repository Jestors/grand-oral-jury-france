export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email requis" });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.URL_SUPABASE;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey)
    return res.status(500).json({ error: "Supabase non configuré" });

  const normalizedEmail = email.toLowerCase().trim();

  // Fetch current user
  const getRes = await fetch(
    `${supabaseUrl}/rest/v1/users_email?email=eq.${encodeURIComponent(normalizedEmail)}&select=simulations_used,is_paid`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    }
  );

  const users = await getRes.json();
  if (!Array.isArray(users) || users.length === 0)
    return res.status(404).json({ error: "Utilisateur introuvable" });

  const user = users[0];

  // Guard: block if not paid and already used 2
  if (!user.is_paid && user.simulations_used >= 2)
    return res.status(403).json({ error: "Limite atteinte", limit_reached: true });

  // Increment
  const updateRes = await fetch(
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
        simulations_used: user.simulations_used + 1,
      }),
    }
  );

  if (!updateRes.ok) {
    const err = await updateRes.text();
    console.error("Supabase update error:", err);
    return res.status(500).json({ error: "Erreur mise à jour" });
  }

  return res.status(200).json({
    ok: true,
    simulations_used: user.simulations_used + 1,
    is_paid: user.is_paid,
  });
}
