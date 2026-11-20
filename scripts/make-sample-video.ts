import { execFile } from "node:child_process"
import { mkdir, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { promisify } from "node:util"
import sharp from "sharp"

const exec = promisify(execFile)
const out = path.join(process.cwd(), "public", "samples")

function svg(angle: number): string {
  const turn = Math.cos((angle * Math.PI) / 180)
  const rx = (36 + 150 * Math.abs(turn)).toFixed(1)
  const stone = Math.max(0, turn).toFixed(2)
  const back = Math.max(0, -turn).toFixed(2)
  const scratch = Math.exp(-((angle - 100) ** 2) / 700).toFixed(2)
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="960">
  <rect width="640" height="960" fill="#f4f1ec"/>
  <ellipse cx="320" cy="640" rx="170" ry="26" fill="#000" opacity="0.08"/>
  <ellipse cx="320" cy="460" rx="${rx}" ry="156" fill="none" stroke="#b8924a" stroke-width="28"/>
  <circle cx="320" cy="286" r="24" fill="#f7f7f7" stroke="#222" stroke-width="3" opacity="${stone}"/>
  <text x="320" y="468" text-anchor="middle" font-size="28" fill="#6b5424" opacity="${back}">750</text>
  <path d="M450 400 C470 460 468 530 446 570" stroke="#333" stroke-width="3" fill="none" opacity="${scratch}"/>
</svg>`
}

async function main() {
  const dir = path.join(os.tmpdir(), `sj-sample-${Date.now()}`)
  await mkdir(dir, { recursive: true })
  await mkdir(out, { recursive: true })
  const frames = 80
  for (let index = 0; index < frames; index += 1) {
    const hold = index >= 30 && index <= 34
    const angle = hold ? 120 : (index / frames) * 340
    let image = sharp(Buffer.from(svg(angle))).jpeg({ quality: 80 })
    if (index % 11 === 0) image = image.blur(8)
    await writeFile(path.join(dir, `f-${String(index).padStart(3, "0")}.jpg`), await image.toBuffer())
  }
  const target = path.join(out, "ring-turn.mp4")
  await exec("ffmpeg", ["-y", "-framerate", "10", "-i", path.join(dir, "f-%03d.jpg"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", target])
  await rm(dir, { recursive: true, force: true })
  console.log(target)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
