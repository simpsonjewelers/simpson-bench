import { jsonError } from "@/lib/http"
import { reportRows } from "@/lib/repo"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const kind = url.searchParams.get("kind")
  const days = Number(url.searchParams.get("days") || 30)
  if (kind !== "in-progress" && kind !== "awaiting" && kind !== "pickup" && kind !== "risk" && kind !== "queue") {
    return jsonError("Unknown report.")
  }
  return Response.json({ rows: reportRows(kind, Number.isFinite(days) ? days : 30) })
}
