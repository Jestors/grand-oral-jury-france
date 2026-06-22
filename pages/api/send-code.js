function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email } = req.body;
  if (!email || !email.includes("@")) return res.status(400).json({ error: "Email invalide" });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.URL_SUPABASE;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: "Supabase non configuré" });

  const normalizedEmail = email.toLowerCase().trim();
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const upsertRes = await fetch(`${supabaseUrl}/rest/v1/verification_codes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({ email: normalizedEmail, code, expires_at: expiresAt, attempts: 0 }),
  });

  if (!upsertRes.ok) {
    const err = await upsertRes.text();
    console.error("Supabase error:", err);
    return res.status(500).json({ error: "Erreur base de données" });
  }

  const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": process.env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: { name: "Simulateur Grand Oral", email: "jestors12@gmail.com" },
      to: [{ email: normalizedEmail }],
      subject: "Votre code de connexion — Simulateur Grand Oral",
      htmlContent: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
          <div style="background:#1C1A2E;padding:28px 32px;text-align:center">
            <div style="font-size:32px;margin-bottom:8px">⚖️</div>
            <div style="color:#9A8EF5;font-size:13px;letter-spacing:.1em;text-transform:uppercase">Simulateur Grand Oral</div>
          </div>
          <div style="padding:32px">
            <p style="font-size:16px;color:#1C1A2E;font-weight:600;margin:0 0 8px">Votre code de connexion</p>
            <p style="font-size:13px;color:#666;margin:0 0 28px;line-height:1.6">
              Utilisez ce code pour accéder au simulateur. Il expire dans <strong>10 minutes</strong>.
            </p>
            <div style="text-align:center;margin:0 0 28px">
              <div style="display:inline-block;background:#EDE9FF;border:2px solid #6558D3;border-radius:14px;padding:18px 40px">
                <div style="font-size:38px;font-weight:700;letter-spacing:10px;color:#3D2FA0;font-family:monospace">${code}</div>
              </div>
            </div>
            <p style="font-size:12px;color:#aaa;line-height:1.6;margin:0">
              Si vous n'avez pas demandé ce code, ignorez cet email.<br>
              Conçu par <strong>Jenny ESTORS</strong> — Professeur d'Économie-Gestion
            </p>
          </div>
        </div>
      `,
    }),
  });

  if (!brevoRes.ok) {
    const errData = await brevoRes.json();
    console.error("Brevo error:", errData);
    return res.status(500).json({ error: "Erreur lors de l'envoi de l'email" });
  }

  return res.status(200).json({ sent: true });
}
