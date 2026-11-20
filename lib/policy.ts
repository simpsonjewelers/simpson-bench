import { daysBetween } from "./format"

export const DEFAULT_POLICY_TEXT =
  "Items not picked up within one year of completion are subject to sale to satisfy charges under NY Lien Law §186 after 30 days' written notice."

export type ShopSettings = {
  reminderDays: number[]
  lienAfterDays: number
  redemptionDays: number
  approachDays: number
  policyText: string
}

export const DEFAULT_SETTINGS: ShopSettings = {
  reminderDays: [30, 60, 90, 180],
  lienAfterDays: 365,
  redemptionDays: 30,
  approachDays: 60,
  policyText: DEFAULT_POLICY_TEXT,
}

export type LienStage = "none" | "at_risk" | "eligible_notice" | "notice_mailed" | "eligible_sale" | "sold"

export function normalizeSettings(value: Partial<ShopSettings> | null | undefined): ShopSettings {
  const reminderDays = Array.isArray(value?.reminderDays)
    ? value.reminderDays.map(Number).filter((n) => Number.isFinite(n) && n > 0)
    : DEFAULT_SETTINGS.reminderDays
  return {
    reminderDays: reminderDays.length ? [...new Set(reminderDays)].sort((a, b) => a - b) : DEFAULT_SETTINGS.reminderDays,
    lienAfterDays: clampInt(value?.lienAfterDays, 1, 3650, DEFAULT_SETTINGS.lienAfterDays),
    redemptionDays: clampInt(value?.redemptionDays, 1, 365, DEFAULT_SETTINGS.redemptionDays),
    approachDays: clampInt(value?.approachDays, 1, 365, DEFAULT_SETTINGS.approachDays),
    policyText: value?.policyText?.trim() || DEFAULT_POLICY_TEXT,
  }
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

export function computeLienStage(
  input: {
    status: string
    readyAt: string | null
    noticeMailedOn: string | null
    lienStage: string
    paymentStatus: string
  },
  settings: ShopSettings,
  now = new Date(),
): LienStage {
  if (input.status === "sold" || input.lienStage === "sold") return "sold"
  if (input.status === "picked_up") return "none"
  if (input.noticeMailedOn && input.status === "ready") {
    const sinceMail = daysBetween(input.noticeMailedOn, now)
    if (sinceMail >= settings.redemptionDays && input.paymentStatus !== "paid") return "eligible_sale"
    return "notice_mailed"
  }
  if (input.status !== "ready" || !input.readyAt) return "none"
  const days = daysBetween(input.readyAt, now)
  if (days >= settings.lienAfterDays) return "eligible_notice"
  if (days >= settings.lienAfterDays - settings.approachDays) return "at_risk"
  return "none"
}

export function dueReminder(daysSinceReady: number, sentMilestones: number[], thresholds: number[]): number | null {
  const sorted = [...thresholds].filter((n) => n > 0).sort((a, b) => a - b)
  const sent = new Set(sentMilestones)
  const reached = sorted.filter((day) => daysSinceReady >= day)
  for (let i = reached.length - 1; i >= 0; i -= 1) {
    const day = reached[i]
    const laterSent = [...sent].some((sentDay) => sentDay > day)
    if (!sent.has(day) && !laterSent) return day
  }
  return null
}

export function lienStageLabel(stage: string): string {
  switch (stage) {
    case "at_risk":
      return "Approaching one year"
    case "eligible_notice":
      return "Eligible for lien notice"
    case "notice_mailed":
      return "Written notice mailed"
    case "eligible_sale":
      return "Eligible for sale"
    case "sold":
      return "Sold"
    default:
      return "—"
  }
}

export const LIEN_NOTE =
  "Text messages are a courtesy only. They are not the written notice required by NY Lien Law §186. Have an attorney review the letter and the shop's process before relying on it."
