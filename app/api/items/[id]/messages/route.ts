import { daysBetween, formatDay, formatMoney, parseDollars } from "@/lib/format"
import { jsonError, publicBase } from "@/lib/http"
import { getItem, getSettings } from "@/lib/repo"
import { previewText, reminderKey, renderItemTemplate, sendText } from "@/lib/sms"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const item = getItem(id)
    if (!item) return jsonError("That ticket is not on the bench.", 404)
    const body = (await request.json()) as {
      action?: "preview" | "send"
      kind?: "quote" | "ready" | "reminder_approval" | "reminder_pickup"
      text?: string
      price?: string
      readyDate?: string
      milestone?: number | null
    }
    const kind = body.kind
    if (!kind) return jsonError("Choose which text to prepare.")
    const base = publicBase(request)
    const settings = getSettings()
    const price = body.price?.trim() ? formatMoney(parseDollars(body.price) ?? 0) : undefined
    const readyDate = body.readyDate ? formatDay(body.readyDate) : undefined
    const waitingDays = item.readyAt ? daysBetween(item.readyAt) : item.quotedAt ? daysBetween(item.quotedAt) : 0
    const templateKey = templateFor(kind, body.milestone ?? null, settings.reminderDays)
    const rendered = renderItemTemplate(item, templateKey.split("@")[0], base, {
      price,
      readyDate,
      days: String(waitingDays),
    })
    if (body.action === "preview") {
      return Response.json({ preview: previewText(item, rendered), templateKey })
    }
    const text = (body.text || rendered).trim()
    if (!text) return jsonError("The message is empty.")
    if (kind === "quote") {
      if (!body.price?.trim() || !body.readyDate) return jsonError("Enter the price and the estimated ready date.")
      if (["in_repair", "ready", "picked_up", "sold"].includes(item.status)) {
        return jsonError("This piece is already past the quote. Change the status if you need a new estimate.")
      }
    }
    const result = await sendText({
      item,
      body: text,
      templateKey: kind === "reminder_approval" || kind === "reminder_pickup" ? reminderKey(kind, body.milestone ?? null, settings.reminderDays) : templateKey,
      base,
      after: kind === "quote" ? "quote" : kind === "ready" ? "ready" : undefined,
      price: body.price,
      readyDate: body.readyDate,
    })
    return Response.json(result)
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "The text could not be sent.")
  }
}

function templateFor(kind: string, milestone: number | null, thresholds: number[]): string {
  if (kind === "quote") return "quote"
  if (kind === "ready") return "ready"
  return reminderKey(kind === "reminder_pickup" ? "reminder_pickup" : "reminder_approval", milestone, thresholds)
}
