import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email } = req.body;
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Email invalide" });
  }

  const { data: user, error } = await supabase
    .from("users_email")
    .select("simulations_used, is_paid")
    .eq("email", email)
    .single();

  if (error || !user) {
    return res.status(200).json({
      simulations_used: 0,
      is_paid: false,
    });
  }

  await supabase
    .from("users_email")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("email", email);

  return res.status(200).json({
    simulations_used: user.simulations_used,
    is_paid: user.is_paid,
  });
}
