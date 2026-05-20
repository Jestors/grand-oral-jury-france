export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: "Données manquantes" });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.URL_SUPABASE;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: "Supabase non configuré" });

  const normalizedEmail = email.toLowerCase().trim();
  const MAX_ATTEMPTS = 5;

  // Récupérer le code en base
  const getRes = await fetch(
    `${supabaseUrl}/rest/v1/verification_codes?email=eq.${encodeURIComponent(normalizedEmail)}&select=*`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    }
  );
  const rows = await getRes.json();

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: "Aucun code envoyé pour cet email" });
  }

  const row = rows[0];

  // Vérifier expiration
  if (new Date(row.expires_at) < new Date()) {
    await fetch(`${supabaseUrl}/rest/v1/verification_codes?email=eq.${encodeURIComponent(normalizedEmail)}`, {
      method: "DELETE",
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    });
    return res.status(400).json({ error: "Code expiré — demandez un nouveau code" });
  }

  // Vérifier tentatives
  if (row.attempts >= MAX_ATTEMPTS) {
    await fetch(`${supabaseUrl}/rest/v1/verification_codes?email=eq.${encodeURIComponent(normalizedEmail)}`, {
      method: "DELETE",
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    });
    return res.status(400).json({ error: "Trop de tentatives — demandez un nouveau code" });
  }

  // Vérifier le code
  if (row.code !== code) {
    await fetch(`${supabaseUrl}/rest/v1/verification_codes?email=eq.${encodeURIComponent(normalizedEmail)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ attempts: row.attempts + 1 }),
    });
    const remaining = MAX_ATTEMPTS - row.attempts - 1;
    return res.status(400).json({
      error: remaining > 0
        ? `Code incorrect (${remaining} tentative${remaining > 1 ? "s" : ""} restante${remaining > 1 ? "s" : ""})`
        : "Code incorrect — demandez un nouveau code",
    });
  }

  // Code correct → supprimer le code
  await fetch(`${supabaseUrl}/rest/v1/verification_codes?email=eq.${encodeURIComponent(normalizedEmail)}`, {
    method: "DELETE",
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  });

  // Upsert utilisateur dans users_email
  const upsertRes = await fetch(`${supabaseUrl}/rest/v1/users_email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({ email: normalizedEmail, last_seen_at: new Date().toISOString() }),
  });

  if (!upsertRes.ok) {
    const err = await upsertRes.text();
    console.error("Upsert error:", err);
    return res.status(500).json({ error: "Erreur base de données" });
  }

  const users = await upsertRes.json();
  const user = Array.isArray(users) ? users[0] : users;

  return res.status(200).json({
    verified: true,
    simulations_used: user?.simulations_used ?? 0,
    is_paid: user?.is_paid ?? false,
  });
}
