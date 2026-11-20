import { jsonError } from "@/lib/http"
import { setStatus } from "@/lib/repo"
import { isStatus } from "@/lib/statuses"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const body = (await request.json()) as { status?: string; note?: string }
    if (!body.status || !isStatus(body.status)) return jsonError("Choose a status.")
    return Response.json({ item: setStatus(id, body.status, body.note?.trim() || "Status updated by staff.") })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Status could not be changed.")
  }
}
