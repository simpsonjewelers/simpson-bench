import { jsonError } from "@/lib/http"
import { applyVision, getItem, readPhoto } from "@/lib/repo"
import { describeJewelry } from "@/lib/vision"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const item = getItem(id)
    if (!item) return jsonError("That ticket is not on the bench.", 404)
    if (!item.photos.length) return jsonError("This ticket has no photos to read.")
    const images: Buffer[] = []
    const step = Math.max(1, Math.ceil(item.photos.length / 8))
    for (let index = 0; index < item.photos.length && images.length < 8; index += step) {
      const photo = await readPhoto(item.photos[index].id, "full")
      if (photo) images.push(photo)
    }
    const vision = await describeJewelry(images)
    return Response.json({ item: applyVision(item.id, vision) })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "The photos could not be read.")
  }
}
