import { last4, normalizePhone } from "@/lib/format"
import { clientIp, jsonError } from "@/lib/http"
import { toPublicStatus } from "@/lib/public-view"
import { findByTicket, rateLimited } from "@/lib/repo"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    if (rateLimited(clientIp(request))) {
      return jsonError("Too many lookups. Wait a few minutes and try again.", 429)
    }
    const body = (await request.json()) as { ticket?: string; phoneLast4?: string }
    const ticket = body.ticket?.trim() ?? ""
    const tail = (body.phoneLast4 ?? "").replace(/\D/g, "")
    if (!ticket || tail.length !== 4) return jsonError("Enter the ticket number and the last 4 digits of the phone number.")
    const item = findByTicket(ticket)
    const phone = item ? normalizePhone(item.customerPhone) || item.customerPhone : ""
    if (!item || last4(phone) !== tail) {
      return jsonError("Those details do not match a ticket. Check the number and try again.")
    }
    return Response.json({ status: toPublicStatus(item) })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Lookup failed.", 500)
  }
}
