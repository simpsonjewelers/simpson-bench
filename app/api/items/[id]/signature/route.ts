import { jsonError } from "@/lib/http"
import { readSignature, saveSignature } from "@/lib/repo"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const png = await readSignature(id)
  if (!png) return jsonError("No signature on file.", 404)
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=3600" } })
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const form = await request.formData()
    const file = form.get("signature")
    if (!(file instanceof File) || !file.size) return jsonError("Sign in the box first.")
    const item = await saveSignature(id, Buffer.from(await file.arrayBuffer()))
    return Response.json({ item })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "The signature could not be saved.")
  }
}
