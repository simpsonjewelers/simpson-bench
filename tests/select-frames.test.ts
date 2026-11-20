import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { hamming, selectFrames, type FrameMetric } from "../lib/select-frames"

function frame(index: number, extra: Partial<FrameMetric> = {}): FrameMetric {
  let hash = 0n
  const bits = Math.min(64, (index + 1) * 3)
  for (let bit = 0; bit < bits; bit += 1) hash |= 1n << BigInt(bit)
  return {
    index,
    timestampSec: index * 0.25,
    sharpness: 80,
    luminance: 120,
    hash,
    ...extra,
  }
}

describe("selectFrames", () => {
  it("keeps a spread of sharp views and drops blur", () => {
    const frames = Array.from({ length: 24 }, (_, index) => frame(index, index % 7 === 0 ? { sharpness: 2 } : {}))
    const selected = selectFrames(frames)
    assert.ok(selected.frames.length >= 6 && selected.frames.length <= 10)
    assert.ok(selected.frames.every((item) => item.sharpness > 2))
    const times = selected.frames.map((item) => item.timestampSec)
    assert.deepEqual(times, [...times].sort((a, b) => a - b))
  })

  it("does not keep near-duplicate frames", () => {
    const hash = 99n
    const frames = Array.from({ length: 12 }, (_, index) => frame(index, { hash, sharpness: 50 + index }))
    const selected = selectFrames(frames)
    assert.equal(selected.frames.length, 1)
    assert.match(selected.warning || "", /Only 1/)
  })
})

describe("hamming", () => {
  it("counts differing bits", () => {
    assert.equal(hamming(0b1010n, 0b1000n), 1)
  })
})
