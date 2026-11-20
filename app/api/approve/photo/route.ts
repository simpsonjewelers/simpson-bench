import { jsonError } from "@/lib/http"
import { findByApprovalToken, readPhoto } from "@/lib/repo"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get("token") ?? ""
  const id = url.searchParams.get("id") ?? ""
  const item = token ? findByApprovalToken(token) : null
  if (!item || !item.photos.some((photo) => photo.id === id)) return jsonError("Photo not found.", 404)
  const image = await readPhoto(id, "thumb")
  if (!image) return jsonError("Photo not found.", 404)
  return new Response(new Uint8Array(image), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" },
  })
}
