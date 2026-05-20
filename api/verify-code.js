import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const MAX_ATTEMPTS = 5;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: "Données manquantes" });

  const { data: row, error: fetchErr } = await supabase
    .from("verification_codes")
    .select("*")
    .eq("email", email)
    .single();

  if (fetchErr || !row) {
    return res.status(400).json({ error: "Aucun code envoyé pour cet email" });
  }

  if (new Date(row.expires_at) < new Date()) {
    await supabase.from("verification_codes").delete().eq("email", email);
    return res.status(400).json({ error: "Code expiré — demandez un nouveau code" });
  }

  if (row.attempts >= MAX_ATTEMPTS) {
    await supabase.from("verification_codes").delete().eq("email", email);
    return res.status(400).json({ error: "Trop de tentatives — demandez un nouveau code" });
  }

  if (row.code !== code) {
    await supabase
      .from("verification_codes")
      .update({ attempts: row.attempts + 1 })
      .eq("email", email);
    const remaining = MAX_ATTEMPTS - row.attempts - 1;
    return res.status(400).json({
      error: remaining > 0
        ? `Code incorrect (${remaining} tentative${remaining > 1 ? "s" : ""} restante${remaining > 1 ? "s" : ""})`
        : "Code incorrect — demandez un nouveau code",
    });
  }

  await supabase.from("verification_codes").delete().eq("email", email);

  const { data: user, error: upsertErr } = await supabase
    .from("users_email")
    .upsert(
      { email, last_seen_at: new Date().toISOString() },
      { onConflict: "email", ignoreDuplicates: false }
    )
    .select("simulations_used, is_paid")
    .single();

  if (upsertErr) {
    console.error("Upsert user error:", upsertErr);
    return res.status(500).json({ error: "Erreur base de données" });
  }

  return res.status(200).json({
    verified: true,
    simulations_used: user?.simulations_used ?? 0,
    is_paid: user?.is_paid ?? false,
  });
}
