import { brand } from "./brand"

export function shopDay(date = new Date(), timeZone = brand.timezone): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const y = parts.find((p) => p.type === "year")?.value ?? "0000"
  const m = parts.find((p) => p.type === "month")?.value ?? "01"
  const d = parts.find((p) => p.type === "day")?.value ?? "01"
  return `${y}-${m}-${d}`
}

export function ticketStamp(day = shopDay()): string {
  return day.slice(2).replace(/-/g, "")
}

export function formatTicket(stamp: string, n: number, prefix = brand.ticketPrefix): string {
  return `${prefix}-${stamp}-${String(n).padStart(3, "0")}`
}

export function daysBetween(fromIso: string, to = new Date(), timeZone = brand.timezone): number {
  const fromDay = fromIso.length <= 10 ? fromIso : shopDay(new Date(fromIso), timeZone)
  const toDay = shopDay(to, timeZone)
  const [ay, am, ad] = fromDay.split("-").map(Number)
  const [by, bm, bd] = toDay.split("-").map(Number)
  if (![ay, am, ad, by, bm, bd].every((n) => Number.isFinite(n))) return 0
  const diff = Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)
  return Math.max(0, Math.round(diff / 86400000))
}

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—"
  const date = iso.length <= 10 ? new Date(`${iso}T12:00:00`) : new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat("en-US", {
    timeZone: brand.timezone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: iso.length <= 10 ? undefined : "numeric",
    minute: iso.length <= 10 ? undefined : "2-digit",
  }).format(date)
}

export function formatDay(iso: string | null | undefined): string {
  if (!iso) return "—"
  const day = iso.length <= 10 ? iso : shopDay(new Date(iso))
  const [y, m, d] = day.split("-").map(Number)
  if (!y || !m || !d) return iso
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)))
}

export function formatMoney(cents: number | null | undefined, currency = brand.currency): string {
  if (cents == null || Number.isNaN(cents)) return "—"
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100)
}

export function parseDollars(input: string): number | null {
  const cleaned = input.trim().replace(/[$,\s]/g, "")
  if (!cleaned) return null
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    throw new Error("Use a price like 85 or 85.50")
  }
  return Math.round(Number(cleaned) * 100)
}

export function dollarsToInput(cents: number | null | undefined): string {
  if (cents == null) return ""
  return (cents / 100).toFixed(2).replace(/\.00$/, "")
}

export function normalizePhone(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const digits = trimmed.replace(/\D/g, "")
  if (trimmed.startsWith("+") && digits.length >= 8 && digits.length <= 15) return `+${digits}`
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  return null
}

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "")
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return value
}

export function last4(value: string): string {
  return value.replace(/\D/g, "").slice(-4)
}

export function balanceCents(input: {
  repairPriceCents: number | null
  depositCents: number
  paymentStatus: string
}): number | null {
  if (input.paymentStatus === "paid") return 0
  if (input.repairPriceCents == null) return null
  return Math.max(0, input.repairPriceCents - input.depositCents)
}

export function fullName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ")
}

export function mailingAddress(parts: { street?: string; apt?: string; city?: string; state?: string; zip?: string }): string {
  const cityLine = [parts.city?.trim(), parts.state?.trim()].filter(Boolean).join(", ")
  const cityZip = [cityLine, parts.zip?.trim()].filter(Boolean).join(" ")
  return [parts.street?.trim(), parts.apt?.trim(), cityZip].filter(Boolean).join("\n")
}

export function itemShort(
  description: string,
  watch?: { brand?: string; model?: string; isWatch?: boolean } | null,
): string {
  const brand = (watch?.brand ?? "").trim()
  if (watch?.isWatch && brand && !/^unknown$/i.test(brand)) {
    return [brand, watch.model].filter(Boolean).join(" ")
  }
  const line = description.split(/[.\n]/)[0]?.trim() ?? ""
  if (!line) return "jewelry piece"
  return line.length > 80 ? `${line.slice(0, 77)}…` : line
}

export function customerDescription(description: string): string {
  const text = description.trim()
  if (!text) return "Your piece"
  const stripped = text.replace(/^appears to be (a |an |the )?/i, "")
  const sentence = (stripped.split(/[.\n]/)[0] ?? stripped).trim()
  if (!sentence) return text
  return sentence.charAt(0).toUpperCase() + sentence.slice(1)
}

export function customerDamage(notes: string): string {
  const text = notes.trim()
  if (!text) return "No damage was noted from the intake photos."
  return text.length > 280 ? `${text.slice(0, 277).trim()}…` : text
}

export function surplusCents(input: {
  salePriceCents: number | null
  saleExpensesCents: number | null
  balance: number | null
}): { surplus: number; remaining: number } | null {
  if (input.salePriceCents == null) return null
  const net = input.salePriceCents - (input.saleExpensesCents ?? 0)
  const due = input.balance ?? 0
  return {
    surplus: Math.max(0, net - due),
    remaining: Math.max(0, due - Math.max(0, net)),
  }
}
