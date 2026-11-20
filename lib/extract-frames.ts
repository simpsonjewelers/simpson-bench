import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import sharp from "sharp"
import { selectFrames, type FrameMetric } from "./select-frames"

const exec = promisify(execFile)

export type ExtractedFrame = {
  buffer: Buffer
  timestampSec: number
  sharpness: number
  hash: string
}

export async function extractBestFrames(videoPath: string): Promise<{
  frames: ExtractedFrame[]
  warning: string | null
  duration: number
}> {
  const probed = await probe(videoPath)
  const dir = await mkdtemp(path.join(os.tmpdir(), "sj-frames-"))
  try {
    const count = Math.min(36, Math.max(12, Math.round(probed.duration * 4)))
    const fps = count / probed.duration
    await exec(
      "ffmpeg",
      ["-y", "-i", videoPath, "-an", "-vf", `fps=${fps},scale='min(1280,iw)':-2`, "-q:v", "3", path.join(dir, "frame-%03d.jpg")],
      { timeout: 90000, maxBuffer: 8 * 1024 * 1024 },
    )
    const names = (await readdir(dir)).filter((name) => name.endsWith(".jpg")).sort()
    if (!names.length) {
      throw new Error("No stills could be read from this video. Try a short MP4 or MOV and turn the piece slowly.")
    }
    const metrics: { metric: FrameMetric; buffer: Buffer }[] = []
    for (let index = 0; index < names.length; index += 1) {
      const buffer = await readFile(path.join(dir, names[index]))
      const measured = await measureFrame(buffer)
      metrics.push({
        buffer,
        metric: {
          index,
          timestampSec: Math.min(probed.duration, ((index + 0.5) / names.length) * probed.duration),
          ...measured,
        },
      })
    }
    const selected = selectFrames(metrics.map((row) => row.metric))
    const frames = selected.frames.map((metric) => {
      const source = metrics.find((row) => row.metric.index === metric.index)!
      return {
        buffer: source.buffer,
        timestampSec: metric.timestampSec,
        sharpness: metric.sharpness,
        hash: metric.hash.toString(16),
      }
    })
    return { frames, warning: selected.warning, duration: probed.duration }
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error("ffmpeg is not installed, so frames cannot be pulled from the video.")
    }
    if (error instanceof Error && /still|video|short|long|ffmpeg is not/i.test(error.message)) throw error
    throw new Error("This video could not be read. iPhone MOV and Android MP4 both work when the clip has a picture.")
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function probe(videoPath: string): Promise<{ duration: number }> {
  try {
    const { stdout } = await exec(
      "ffprobe",
      ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", videoPath],
      { timeout: 20000, maxBuffer: 4 * 1024 * 1024 },
    )
    const payload = JSON.parse(stdout) as { format?: { duration?: string }; streams?: { codec_type?: string }[] }
    const video = payload.streams?.find((stream) => stream.codec_type === "video")
    if (!video) throw new Error("This file has no picture. Record the piece with the camera and try again.")
    const duration = Number(payload.format?.duration ?? 0)
    if (!duration || duration < 0.3) throw new Error("This clip is too short. Turn the piece for about 10 to 20 seconds.")
    if (duration > 90) throw new Error("This clip is longer than 90 seconds. Record one slow turn, about 10 to 20 seconds.")
    return { duration }
  } catch (error) {
    if (error instanceof Error && /picture|short|long/.test(error.message)) throw error
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error("ffmpeg is not installed, so frames cannot be pulled from the video.")
    }
    throw new Error("This video could not be read. Try the clip again as a MOV or MP4.")
  }
}

export async function measureFrame(buffer: Buffer): Promise<{ sharpness: number; luminance: number; hash: bigint }> {
  const base = sharp(buffer).rotate()
  const gray = await base.clone().resize(160, 160, { fit: "cover" }).grayscale().raw().toBuffer({ resolveWithObject: true })
  const sharpness = varianceOfLaplacian(gray.data, gray.info.width, gray.info.height)
  let total = 0
  for (const value of gray.data) total += value
  const luminance = total / Math.max(1, gray.data.length)
  const hashImage = await base.clone().resize(9, 8, { fit: "fill" }).grayscale().raw().toBuffer()
  let hash = 0n
  let bit = 0n
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      if (hashImage[y * 9 + x] > hashImage[y * 9 + x + 1]) hash |= 1n << bit
      bit += 1n
    }
  }
  return { sharpness, luminance, hash }
}

function varianceOfLaplacian(data: Buffer, width: number, height: number): number {
  let sum = 0
  let sumSq = 0
  let n = 0
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x
      const value = -4 * data[index] + data[index - 1] + data[index + 1] + data[index - width] + data[index + width]
      sum += value
      sumSq += value * value
      n += 1
    }
  }
  if (!n) return 0
  const mean = sum / n
  return sumSq / n - mean * mean
}
