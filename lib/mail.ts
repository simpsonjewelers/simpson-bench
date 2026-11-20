import nodemailer from "nodemailer"
import { brand } from "./brand"

export function smtpConfig() {
  const host = process.env.SMTP_HOST?.trim() ?? ""
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER?.trim() ?? ""
  const pass = process.env.SMTP_PASS?.trim() ?? ""
  const from = process.env.SMTP_FROM?.trim() || brand.email
  return { host, port, user, pass, from, enabled: Boolean(host && from) }
}

export async function sendEmail(to: string, subject: string, text: string): Promise<{ testMode: boolean }> {
  const smtp = smtpConfig()
  if (!smtp.enabled) return { testMode: true }
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
  })
  await transport.sendMail({ from: smtp.from, to, subject, text })
  return { testMode: false }
}
