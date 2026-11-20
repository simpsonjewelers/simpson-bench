import { jsonError } from "@/lib/http"
import { getItem, updateItem } from "@/lib/repo"
import type { PaymentStatus } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const item = getItem(id)
  if (!item) return jsonError("That ticket is not on the bench.", 404)
  return Response.json({ item })
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const body = (await request.json()) as {
      customerName?: string
      customerPhone?: string
      customerAddress?: string
      smsConsent?: boolean
      requestedRepair?: string
      staffNotes?: string
      description?: string
      damageNotes?: string
      repairPrice?: string | null
      estimateReadyOn?: string | null
      deposit?: string | null
      paymentStatus?: PaymentStatus
    }
    return Response.json({ item: updateItem(id, body) })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "The ticket could not be saved.")
  }
}
