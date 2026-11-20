import { mkdir, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { extractBestFrames } from "@/lib/extract-frames"
import { jsonError } from "@/lib/http"
import { createFromIntake, updateItem } from "@/lib/repo"
import { describeJewelry } from "@/lib/vision"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const MAX_BYTES = 80 * 1024 * 1024

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const customer = JSON.parse(String(form.get("customer") || "{}")) as { firstName?: string; lastName?: string; customerPhone?: string }
    if (!customer.firstName?.trim() || !customer.lastName?.trim() || !customer.customerPhone?.trim()) {
      return jsonError("First name, last name, and mobile are required.")
    }
    const sample = form.get("sample") === "1"
    const video = form.get("video")
    const photoFiles = form.getAll("photos").filter((entry): entry is File => entry instanceof File && entry.size > 0)
    let frames: { buffer: Buffer; timestampSec: number; sharpness: number }[] = []
    let warning: string | null = null
    if (sample || video instanceof File) {
      const videoPath = sample ? path.join(process.cwd(), "public", "samples", "ring-turn.mp4") : await saveUpload(video)
      const extracted = await extractBestFrames(videoPath)
      frames = extracted.frames
      warning = extracted.warning
      if (!sample && video instanceof File) await import("node:fs/promises").then((fs) => fs.rm(videoPath, { force: true }))
    }
    for (const photo of photoFiles) {
      frames.push({ buffer: Buffer.from(await photo.arrayBuffer()), timestampSec: frames.length, sharpness: 1 })
    }
    if (!frames.length) return jsonError(warning || "Record a video or take a photo first.")
    const vision = await describeJewelry(frames.map((frame) => frame.buffer))
    const created = await createFromIntake({ frames, warning, vision })
    const item = updateItem(created.id, customer)
    return Response.json({ item })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "The intake could not be saved.")
  }
}

async function saveUpload(value: FormDataEntryValue | null): Promise<string> {
  if (!(value instanceof File) || !value.size) throw new Error("Choose a video of the piece first.")
  if (value.size > MAX_BYTES) throw new Error("That video is over 80 MB. Record a shorter turn, about 10 to 20 seconds.")
  const ext = path.extname(value.name || "").toLowerCase() || ".mp4"
  if (![".mp4", ".mov", ".m4v", ".webm", ".qt"].includes(ext)) {
    throw new Error("Use a MOV, MP4, or WEBM video.")
  }
  const file = path.join(os.tmpdir(), `sj-upload-${Date.now()}${ext}`)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, Buffer.from(await value.arrayBuffer()))
  return file
}
