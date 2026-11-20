import sharp from "sharp"
import type { SuggestedPart } from "./catalog"
import type { MovementType } from "./types"

export const NO_KEY_MESSAGE =
  "No vision API key is set, so a description and damage notes were not written. Add VISION_API_KEY and use “Write notes with AI”, or type them yourself. The photos and the ticket are saved."

export type VisionWatch = {
  brand: string
  model: string
  referenceNo: string
  caseSize: string
  caseMaterial: string
  dial: string
  movementType: MovementType
  caliber: string
  confidence: "low" | "medium" | "high" | ""
  confidenceNote: string
  needsCaseback: boolean
  needsDial: boolean
  visibleText: string[]
  suggestedParts: SuggestedPart[]
}

export type VisionResult = {
  status: "ok" | "no_key" | "error"
  message: string | null
  description: string
  damageNotes: string
  watch: VisionWatch | null
}

const PROMPT = `You document one jewelry item for a repair shop, using only what is visible in the photos.
Respond with JSON only:
{
  "description": "2-4 sentences. Type (ring, necklace, bracelet, earring, watch, or other), apparent metal color, stones, style, and markings. Use the word appears.",
  "damageNotes": "What appears damaged: broken or missing prongs, loose or missing stones, broken clasp, kinks, cracks, bends, scratches, tarnish, stretched links. If nothing visible looks damaged, say no damage is visible in these photos. Use appears.",
  "isWatch": false,
  "watch": null
}
If the item appears to be a watch, set isWatch true and watch to:
{
  "brand": "",
  "model": "",
  "referenceNumber": "",
  "caseSize": "",
  "caseMaterial": "",
  "dial": "",
  "movementType": "automatic|manual|quartz|unknown",
  "caliber": "",
  "confidence": "low|medium|high",
  "confidenceNote": "why the confidence is not higher",
  "dialReadable": false,
  "casebackReadable": false,
  "visibleText": ["text you can actually read on the dial, caseback, or clasp"],
  "suggestedParts": [{ "name": "Crystal", "partNumber": "", "reason": "why this part is typical" }]
}
Watch rules:
- Read the dial, caseback, and clasp when the text is actually visible. Do not invent a brand, model, reference, or caliber.
- Leave a field blank when you cannot read it, and lower confidence.
- Never output a serial number. If a serial seems visible, you may include that line in visibleText only.
- suggestedParts are an unverified fallback for when the shop has no parts list: crystal, crown, stem, gaskets, and a mainspring for a mechanical watch or a battery for quartz. Include a manufacturer part number only when it is printed in the photos or you are naming a standard cell for a caliber you can read. Otherwise leave partNumber empty.
- Do not mention parts suppliers or where to buy parts.`

export function visionConfigured(): boolean {
  return Boolean(process.env.VISION_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim())
}

export async function describeJewelry(images: Buffer[]): Promise<VisionResult> {
  const key = process.env.VISION_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim()
  if (!key) {
    return { status: "no_key", message: NO_KEY_MESSAGE, description: "", damageNotes: "", watch: null }
  }
  const base = (process.env.VISION_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "")
  const model = process.env.VISION_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini"
  const prepared = await Promise.all(images.slice(0, 8).map((image) => shrink(image)))
  const content = [
    { type: "text", text: PROMPT },
    ...prepared.map((image) => ({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${image.toString("base64")}` },
    })),
  ]
  try {
    const text = await complete(base, key, model, content, true)
    return parseVision(text)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Vision request failed"
    if (/response_format|json_object/i.test(message)) {
      try {
        const text = await complete(base, key, model, content, false)
        return parseVision(text)
      } catch (retryError) {
        const retryMessage = retryError instanceof Error ? retryError.message : message
        return { status: "error", message: retryMessage, description: "", damageNotes: "", watch: null }
      }
    }
    return { status: "error", message, description: "", damageNotes: "", watch: null }
  }
}

async function shrink(image: Buffer): Promise<Buffer> {
  return sharp(image).rotate().resize(1024, 1024, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer()
}

async function complete(
  base: string,
  key: string,
  model: string,
  content: unknown[],
  jsonMode: boolean,
): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 45000)
  try {
    const response = await fetch(`${base}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You only describe what is visible in the photos. You use cautious wording such as appears. You never state metal purity, stone identity, or value as fact.",
          },
          { role: "user", content },
        ],
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
    })
    const payload = (await response.json().catch(() => ({}))) as {
      error?: { message?: string }
      choices?: { message?: { content?: string } }[]
    }
    if (!response.ok) {
      throw new Error(payload.error?.message || `Vision service returned ${response.status}`)
    }
    const text = payload.choices?.[0]?.message?.content?.trim()
    if (!text) throw new Error("Vision service returned an empty note.")
    return text
  } finally {
    clearTimeout(timer)
  }
}

export function parseVision(raw: string): VisionResult {
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim()
  let data: Record<string, unknown>
  try {
    data = JSON.parse(cleaned) as Record<string, unknown>
  } catch {
    return {
      status: "error",
      message: "The vision model did not return readable notes. You can type them yourself.",
      description: "",
      damageNotes: "",
      watch: null,
    }
  }
  const description = asText(data.description)
  const damageNotes = asText(data.damageNotes)
  const watch = data.isWatch ? parseWatch(data.watch) : null
  if (!description && !damageNotes && !watch) {
    return {
      status: "error",
      message: "The vision model did not return a description. You can type the notes yourself.",
      description: "",
      damageNotes: "",
      watch: null,
    }
  }
  return { status: "ok", message: null, description, damageNotes, watch }
}

function parseWatch(value: unknown): VisionWatch | null {
  if (!value || typeof value !== "object") return null
  const watch = value as Record<string, unknown>
  const movement = asText(watch.movementType).toLowerCase()
  const movementType: MovementType =
    movement === "automatic" || movement === "manual" || movement === "quartz" ? movement : "unknown"
  const confidenceRaw = asText(watch.confidence).toLowerCase()
  const confidence = confidenceRaw === "high" || confidenceRaw === "medium" || confidenceRaw === "low" ? confidenceRaw : "low"
  const parts = Array.isArray(watch.suggestedParts) ? watch.suggestedParts : []
  return {
    brand: asText(watch.brand),
    model: asText(watch.model ?? watch.collection),
    referenceNo: asText(watch.referenceNumber ?? watch.referenceNo ?? watch.reference),
    caseSize: asText(watch.caseSize),
    caseMaterial: asText(watch.caseMaterial),
    dial: asText(watch.dial),
    movementType,
    caliber: asText(watch.caliber ?? watch.calibre),
    confidence,
    confidenceNote: asText(watch.confidenceNote),
    needsDial: watch.dialReadable === false || !asText(watch.dial),
    needsCaseback: watch.casebackReadable === false,
    visibleText: Array.isArray(watch.visibleText) ? watch.visibleText.map((line) => asText(line)).filter(Boolean) : [],
    suggestedParts: parts
      .map((part) => {
        const row = part as Record<string, unknown>
        return {
          name: asText(row.name),
          partNumber: asText(row.partNumber ?? row.number),
          reason: asText(row.reason),
        }
      })
      .filter((part) => part.name),
  }
}

function asText(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => asText(item)).filter(Boolean).join("\n")
  return typeof value === "string" ? value.trim() : ""
}
