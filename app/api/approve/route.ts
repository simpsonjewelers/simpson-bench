import { customerDamage, customerDescription, formatMoney } from "@/lib/format"
import { clientIp, jsonError } from "@/lib/http"
import { findByApprovalToken, rateLimited, readPhoto } from "@/lib/repo"
import { decideFromPage } from "@/lib/sms"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? ""
  const item = token ? findByApprovalToken(token) : null
  if (!item) return jsonError("This approval link is not valid.", 404)
  const photos = item.photos.slice(0, 3).map((photo) => ({
    id: photo.id,
    url: `/api/approve/photo?token=${encodeURIComponent(token)}&id=${encodeURIComponent(photo.id)}`,
  }))
  return Response.json({
    ticketNumber: item.ticketNumber,
    requestedRepair: item.requestedRepair,
    description: customerDescription(item.description),
    damageNotes: customerDamage(item.damageNotes),
    photos,
    quote: item.repairPriceCents == null ? null : formatMoney(item.repairPriceCents),
    ready: item.estimateReadyOn,
    status: item.status,
    already: item.status !== "awaiting_approval",
  })
}

export async function POST(request: Request) {
  try {
    if (rateLimited(`approve:${clientIp(request)}`, 12)) return jsonError("Too many tries. Wait a few minutes.", 429)
    const body = (await request.json()) as { token?: string; decision?: "yes" | "no" }
    if (!body.token || (body.decision !== "yes" && body.decision !== "no")) return jsonError("Choose approve or decline.")
    const result = decideFromPage(body.token, body.decision)
    return Response.json({
      already: result.already,
      status: result.item.status,
      ticketNumber: result.item.ticketNumber,
    })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "That choice could not be saved.")
  }
}
