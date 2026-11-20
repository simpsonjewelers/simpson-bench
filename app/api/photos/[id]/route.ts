import { readPhoto } from "@/lib/repo"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const size = new URL(request.url).searchParams.get("size") === "thumb" ? "thumb" : "full"
  const image = await readPhoto(id, size)
  if (!image) return new Response("Not found", { status: 404 })
  return new Response(new Uint8Array(image), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" },
  })
}
