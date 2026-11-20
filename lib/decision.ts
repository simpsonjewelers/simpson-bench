export type Decision = "yes" | "no" | "stop"

export function parseDecision(body: string): Decision | null {
  const text = body.trim().toLowerCase().replace(/[.!]+$/g, "").replace(/\s+/g, " ")
  if (!text) return null
  if (["stop", "stopall", "unsubscribe", "cancel", "end", "quit"].includes(text)) return "stop"
  if (/^(yes|y|approve|approved|ok|okay)\b/.test(text)) return "yes"
  if (/^(no|n|decline|declined|deny|denied)\b/.test(text)) return "no"
  return null
}

export function milestoneFromKey(templateKey: string | null | undefined): number | null {
  if (!templateKey) return null
  const match = templateKey.match(/@(\d+)$/)
  if (!match) return null
  return Number(match[1])
}

export function isApprovalReminder(templateKey: string | null | undefined): boolean {
  return !!templateKey && templateKey.startsWith("reminder_approval")
}

export function isPickupReminder(templateKey: string | null | undefined): boolean {
  return !!templateKey && /^reminder_(pickup|firm|final)/.test(templateKey)
}
