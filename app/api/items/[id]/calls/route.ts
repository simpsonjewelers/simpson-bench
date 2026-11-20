import { jsonError } from "@/lib/http"
import { addCall } from "@/lib/repo"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const body = (await request.json()) as { outcome?: string; note?: string }
    if (!body.outcome) return jsonError("Choose how the call went.")
    return Response.json({ item: addCall(id, body.outcome, body.note ?? "") })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "The call could not be logged.")
  }
}
