import { jsonError } from "@/lib/http"
import { addNote } from "@/lib/repo"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const body = (await request.json()) as { body?: string; author?: string }
    return Response.json({ item: addNote(id, body.body ?? "", body.author ?? "Staff") })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "The note could not be saved.")
  }
}
