// pages/api/send-code.js
// Envoie un code de vérification à 6 chiffres via Resend
// Variables d'env requises : RESEND_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email } = req.body;
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Email invalide" });
  }

  const code      = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

  // ── 1. Upsert code dans Supabase (table : verification_codes) ──────────
  // Table SQL à créer dans Supabase :
  // CREATE TABLE verification_codes (
  //   email      TEXT PRIMARY KEY,
  //   code       TEXT NOT NULL,
  //   expires_at TIMESTAMPTZ NOT NULL,
  //   attempts   INT DEFAULT 0,
  //   created_at TIMESTAMPTZ DEFAULT now()
  // );
  const { error: dbError } = await supabase
    .from("verification_codes")
    .upsert({ email, code, expires_at: expiresAt, attempts: 0 }, { onConflict: "email" });

  if (dbError) {
    console.error("Supabase error:", dbError);
    return res.status(500).json({ error: "Erreur base de données" });
  }

  // ── 2. Envoi email via Resend ──────────────────────────────────────────
  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Grand Oral <noreply@grand-oral-jury-france.vercel.app>",
      // ⚠️  Remplace par ton domaine vérifié dans Resend, ex : noreply@tondomaine.fr
      // Si pas de domaine vérifié, utilise : onboarding@resend.dev (tests seulement)
      to: [email],
      subject: "Votre code de connexion — Simulateur Grand Oral",
      html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FDFCFF;font-family:system-ui,-apple-system,sans-serif">
  <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
    <div style="background:#1C1A2E;padding:28px 32px;text-align:center">
      <div style="font-size:32px;margin-bottom:8px">⚖️</div>
      <div style="color:#9A8EF5;font-size:13px;font-family:monospace;letter-spacing:.1em;text-transform:uppercase">Simulateur Grand Oral</div>
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
    <div style="background:#F4F3F8;padding:16px 32px;text-align:center">
      <p style="font-size:11px;color:#aaa;margin:0">
        🔒 Conforme RGPD · Aucun spam · Données protégées
      </p>
    </div>
  </div>
</body>
</html>
      `,
    }),
  });

  if (!resendRes.ok) {
    const errData = await resendRes.json();
    console.error("Resend error:", errData);
    return res.status(500).json({ error: "Erreur lors de l'envoi de l'email" });
  }

  return res.status(200).json({ sent: true });
}
