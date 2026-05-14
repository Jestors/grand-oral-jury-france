export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { email } = req.body;
  if (!email || !email.includes("@"))
    return res.status(400).json({ error: "Email invalide" });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.URL_SUPABASE;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey)
    return res.status(500).json({ error: "Supabase non configuré" });

  const normalizedEmail = email.toLowerCase().trim();

  // Try to fetch existing user
  const getRes = await fetch(
    `${supabaseUrl}/rest/v1/users_email?email=eq.${encodeURIComponent(normalizedEmail)}&select=*`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    }
  );

  const users = await getRes.json();

  // User exists → return their status
  if (Array.isArray(users) && users.length > 0) {
    const user = users[0];
    return res.status(200).json({
      exists: true,
      simulations_used: user.simulations_used,
      is_paid: user.is_paid,
    });
  }

  // New user → create row
  const createRes = await fetch(`${supabaseUrl}/rest/v1/users_email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      email: normalizedEmail,
      simulations_used: 0,
      is_paid: false,
      created_at: new Date().toISOString(),
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    console.error("Supabase create error:", err);
    return res.status(500).json({ error: "Impossible de créer l'utilisateur" });
  }

  return res.status(200).json({
    exists: false,
    simulations_used: 0,
    is_paid: false,
  });
}
