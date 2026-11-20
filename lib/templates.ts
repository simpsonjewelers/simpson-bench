import { brand } from "./brand"

export type TemplateKey =
  | "quote"
  | "reminder_approval"
  | "ready"
  | "reminder_pickup"
  | "reminder_firm"
  | "reminder_final"
  | "reply_yes"
  | "reply_no"
  | "reply_unknown"
  | "reply_unmatched"

export type MessageTemplate = {
  key: TemplateKey
  label: string
  body: string
}

export const DEFAULT_TEMPLATES: MessageTemplate[] = [
  {
    key: "quote",
    label: "Quote and ready date",
    body: "Ticket {{ticket}}. Estimate to repair your {{item}} is {{price}}, ready about {{ready_date}}. Reply YES to approve or NO to decline.\n{{approve_url}}\nStatus anytime: {{status_url}}",
  },
  {
    key: "reminder_approval",
    label: "Approval reminder",
    body: "Ticket {{ticket}} is still waiting for your approval. Estimate {{price}}, ready about {{ready_date}}. Reply YES to approve or NO to decline.\n{{approve_url}}",
  },
  {
    key: "ready",
    label: "Ready for pickup",
    body: "Ticket {{ticket}} is ready for pickup. Hours: {{hours}}. Please bring your claim slip.\nStatus: {{status_url}}",
  },
  {
    key: "reminder_pickup",
    label: "Pickup reminder",
    body: "Courtesy reminder: ticket {{ticket}} has been ready for {{days}} days. Please pick it up during shop hours. This text is not a legal notice.\nStatus: {{status_url}}",
  },
  {
    key: "reminder_firm",
    label: "Firmer pickup reminder",
    body: "Courtesy reminder: ticket {{ticket}} is still here after {{days}} days. Please collect it or call us. This text is not written notice under New York law.\nStatus: {{status_url}}",
  },
  {
    key: "reminder_final",
    label: "Final courtesy reminder",
    body: "Final courtesy reminder: ticket {{ticket}} has been ready for {{days}} days. Please pick it up. A text is not legal notice. If written notice is required, it will be mailed.\nStatus: {{status_url}}",
  },
  {
    key: "reply_yes",
    label: "Reply when the customer approves",
    body: "Thanks. Ticket {{ticket}} is approved. We will text you when it is ready.\nStatus: {{status_url}}",
  },
  {
    key: "reply_no",
    label: "Reply when the customer declines",
    body: "Thanks. Ticket {{ticket}} is marked declined. Please call the shop to arrange pickup.",
  },
  {
    key: "reply_unknown",
    label: "Reply when the text is unclear",
    body: "Reply YES to approve ticket {{ticket}}, or NO to decline.",
  },
  {
    key: "reply_unmatched",
    label: "Reply when the number does not match",
    body: "We could not match this number to a ticket waiting on approval. Please call the shop.",
  },
]

export function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, key: string) => vars[key] ?? "")
}

export function withSignoff(body: string, signoff = brand.signoff): string {
  const trimmed = body.trim()
  if (!trimmed) return signoff
  if (trimmed.includes(brand.name) && trimmed.includes(brand.phoneDisplay)) return trimmed
  return `${trimmed}\n${signoff}`
}

export function previewDaysForTemplate(key: string, thresholds: number[]): string {
  const sorted = [...thresholds].filter((day) => day > 0).sort((a, b) => a - b)
  if (!sorted.length) return ""
  if (key === "reminder_final") return String(sorted[sorted.length - 1])
  if (key === "reminder_firm") return String(sorted.length >= 3 ? sorted[sorted.length - 2] : sorted[sorted.length - 1])
  if (key === "reminder_pickup") return String(sorted[0])
  return ""
}

export function reminderTemplateForDay(day: number, thresholds: number[]): TemplateKey {
  const sorted = [...thresholds].filter((n) => n > 0).sort((a, b) => a - b)
  if (!sorted.length) return "reminder_pickup"
  const last = sorted[sorted.length - 1]
  const firmFrom = sorted.length >= 2 ? sorted[sorted.length - 2] : last
  if (day >= last) return "reminder_final"
  if (day >= firmFrom && sorted.length >= 3) return "reminder_firm"
  return "reminder_pickup"
}
