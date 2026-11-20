import { parseDollars } from "@/lib/format"
import { jsonError } from "@/lib/http"
import { addTicketPart, deleteTicketPart } from "@/lib/repo"
import type { TicketPart } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const body = (await request.json()) as {
      partName?: string
      partNumber?: string
      qty?: number
      cost?: string
      source?: TicketPart["source"]
    }
    const item = addTicketPart(id, {
      partName: body.partName ?? "",
      partNumber: body.partNumber ?? "",
      qty: Number(body.qty ?? 1),
      unitCostCents: parseDollars(body.cost ?? "") ?? 0,
      source: body.source ?? "manual",
    })
    return Response.json({ item })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "The part could not be added.")
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const partId = new URL(request.url).searchParams.get("partId")
    if (!partId) return jsonError("Choose a part to remove.")
    return Response.json({ item: deleteTicketPart(id, partId) })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "The part could not be removed.")
  }
}
