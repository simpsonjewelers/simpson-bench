export type FrameMetric = {
  index: number
  timestampSec: number
  sharpness: number
  luminance: number
  hash: bigint
}

const MIN_COUNT = 6
const MAX_COUNT = 10

export function hamming(a: bigint, b: bigint): number {
  let x = a ^ b
  let n = 0
  while (x > 0n) {
    n += Number(x & 1n)
    x >>= 1n
  }
  return n
}

export function selectFrames(frames: FrameMetric[]): { frames: FrameMetric[]; warning: string | null } {
  if (!frames.length) {
    return { frames: [], warning: "No frames could be read from this video." }
  }

  const sorted = [...frames].sort((a, b) => a.timestampSec - b.timestampSec || a.index - b.index)
  const exposed = sorted.filter((frame) => frame.luminance >= 18 && frame.luminance <= 245)
  const pool = exposed.length ? exposed : sorted
  const sharps = pool.map((frame) => frame.sharpness).sort((a, b) => a - b)
  const median = sharps[Math.floor((sharps.length - 1) / 2)] ?? 0
  const cutoff = median * 0.45
  let sharp = pool.filter((frame) => frame.sharpness >= cutoff && frame.sharpness > 0)
  let soft = false
  if (sharp.length < Math.min(MIN_COUNT, pool.length)) {
    sharp = pool
    soft = pool.some((frame) => frame.sharpness < cutoff)
  }

  const bucketCount = Math.min(MAX_COUNT, Math.max(1, Math.min(8, sharp.length)))
  const chosen: FrameMetric[] = []
  for (const group of bucketize(sharp, bucketCount)) {
    const ranked = [...group].sort((a, b) => b.sharpness - a.sharpness)
    const pick = ranked.find((frame) => chosen.every((kept) => hamming(kept.hash, frame.hash) >= 8))
    if (pick) chosen.push(pick)
  }

  if (chosen.length < Math.min(MIN_COUNT, sharp.length)) {
    const used = new Set(chosen.map((frame) => frame.index))
    const rest = [...sharp].sort((a, b) => b.sharpness - a.sharpness)
    for (const frame of rest) {
      if (chosen.length >= MIN_COUNT) break
      if (used.has(frame.index)) continue
      if (chosen.every((kept) => hamming(kept.hash, frame.hash) >= 6)) {
        chosen.push(frame)
        used.add(frame.index)
      }
    }
  }

  chosen.sort((a, b) => a.timestampSec - b.timestampSec || a.index - b.index)
  while (chosen.length > MAX_COUNT) {
    dropMostRedundant(chosen)
  }

  let warning: string | null = null
  if (chosen.length < MIN_COUNT) {
    const noun = chosen.length === 1 ? "view" : "views"
    warning = `Only ${chosen.length} distinct sharp ${noun} came out of this video. Turn the piece slowly, and if it is a watch hold the dial and the caseback steady.`
  } else if (soft) {
    warning = "This clip was soft, so these are the clearest frames available. A steadier phone will document the condition better."
  }
  return { frames: chosen, warning }
}

function bucketize(frames: FrameMetric[], buckets: number): FrameMetric[][] {
  if (!frames.length) return []
  const start = frames[0].timestampSec
  const end = frames[frames.length - 1].timestampSec
  const span = Math.max(0.001, end - start)
  const groups: FrameMetric[][] = Array.from({ length: buckets }, () => [])
  for (const frame of frames) {
    const index = Math.min(buckets - 1, Math.floor(((frame.timestampSec - start) / span) * buckets))
    groups[index].push(frame)
  }
  return groups.filter((group) => group.length)
}

function dropMostRedundant(frames: FrameMetric[]) {
  let bestI = 0
  let bestJ = 1
  let best = Number.POSITIVE_INFINITY
  for (let i = 0; i < frames.length; i += 1) {
    for (let j = i + 1; j < frames.length; j += 1) {
      const distance = hamming(frames[i].hash, frames[j].hash)
      if (distance < best) {
        best = distance
        bestI = i
        bestJ = j
      }
    }
  }
  const drop = frames[bestI].sharpness <= frames[bestJ].sharpness ? bestI : bestJ
  frames.splice(drop, 1)
}
