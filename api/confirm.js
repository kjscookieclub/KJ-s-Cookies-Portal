import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "KJ's Cookies <orders@kjscookies.se>";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { to, subject, html } = req.body;

  if (!to || !subject || !html) {
    return res.status(400).json({ error: "Missing required fields: to, subject, html" });
  }

  const { error } = await resend.emails.send({
    from: FROM,
    to,
    reply_to: "hello@kjscookies.se",
    subject,
    html,
  });

  if (error) {
    console.error("Resend error:", error);
    return res.status(500).json({ error: "Email failed", detail: error });
  }

  return res.status(200).json({ success: true });
}
