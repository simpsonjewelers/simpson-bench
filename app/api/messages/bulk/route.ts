import { milestoneFromKey } from "@/lib/decision"
import { daysBetween } from "@/lib/format"
import { jsonError, publicBase } from "@/lib/http"
import { dueReminder } from "@/lib/policy"
import { getItem, getSettings } from "@/lib/repo"
import { previewText, reminderKey, renderItemTemplate, sendText } from "@/lib/sms"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      ids?: string[]
      kind?: "reminder_approval" | "reminder_pickup"
      milestone?: number | null
    }
    const ids = body.ids ?? []
    const kind = body.kind
    if (!ids.length || !kind) return jsonError("Select at least one ticket.")
    const base = publicBase(request)
    const settings = getSettings()
    const results: { id: string; ok: boolean; error?: string; testMode?: boolean }[] = []
    for (const id of ids) {
      const item = getItem(id)
      if (!item) {
        results.push({ id, ok: false, error: "Missing ticket" })
        continue
      }
      try {
        const sentDays = item.messages.map((message) => milestoneFromKey(message.templateKey)).filter((day): day is number => day != null)
        const sinceReady = item.readyAt ? daysBetween(item.readyAt) : 0
        const milestone = kind === "reminder_pickup" ? dueReminder(sinceReady, sentDays, settings.reminderDays) : null
        const key = reminderKey(kind, milestone, settings.reminderDays)
        const text = renderItemTemplate(item, key.split("@")[0], base, { days: String(sinceReady) })
        const preview = previewText(item, text)
        if (preview.warnings.length) throw new Error(preview.warnings[0])
        const sent = await sendText({ item, body: text, templateKey: key, base })
        results.push({ id: item.id, ok: true, testMode: sent.testMode })
      } catch (error) {
        results.push({ id, ok: false, error: error instanceof Error ? error.message : "Not sent" })
      }
    }
    return Response.json({ results, testMode: results.some((result) => result.testMode) })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "The texts could not be sent.")
  }
}
