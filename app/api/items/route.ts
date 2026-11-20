import { jsonError } from "@/lib/http"
import { listItems } from "@/lib/repo"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams.get("q") ?? ""
    return Response.json({ items: listItems(q) })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "The bench could not be loaded.", 500)
  }
}
