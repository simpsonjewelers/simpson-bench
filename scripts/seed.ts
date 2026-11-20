import path from "node:path"
import sharp from "sharp"
import { getDb } from "../lib/db"
import { addTicketPart, createFromIntake, importCatalog, resetAllData, saveWatch, updateItem } from "../lib/repo"
import type { VisionResult } from "../lib/vision"

function piece(label: string, tone: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800">
    <rect width="800" height="800" fill="#f7f7f7"/>
    <circle cx="400" cy="390" r="150" fill="none" stroke="${tone}" stroke-width="28"/>
    <text x="400" y="400" text-anchor="middle" font-size="42" font-family="Georgia" fill="#111">${label}</text>
  </svg>`
  return sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer()
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 86400000).toISOString()
}

async function make(label: string, tone: string, vision: VisionResult) {
  const buffer = await piece(label, tone)
  const frames = [0, 1, 2, 3, 4, 5].map((index) => ({ buffer, timestampSec: index * 0.4, sharpness: 40 + index }))
  return createFromIntake({ frames, warning: null, vision })
}

export async function seedDemo(reset = false) {
  process.env.DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data")
  if (reset) await resetAllData()
  const empty: VisionResult = { status: "no_key", message: "Sample record. Add VISION_API_KEY to read photos.", description: "", damageNotes: "", watch: null }

  const ruth = await make("RING", "#b8924a", {
    ...empty,
    description: "Appears to be a yellow gold ring with a small round clear stone.",
    damageNotes: "One prong appears short. A light scratch appears on the shank.",
  })
  const quoteWatch = await make("SEIKO", "#222", {
    ...empty,
    description: "Appears to be a stainless steel automatic watch with a black dial.",
    damageNotes: "The crystal appears scratched. No damage is otherwise visible in these photos.",
    watch: {
      brand: "Seiko",
      model: "5",
      referenceNo: "SNK809",
      caseSize: "37 mm",
      caseMaterial: "appears stainless steel",
      dial: "black, day-date",
      movementType: "automatic",
      caliber: "7S26",
      confidence: "medium",
      confidenceNote: "Reference is readable on the caseback in this sample.",
      needsCaseback: false,
      needsDial: false,
      visibleText: ["SEIKO", "7S26"],
      suggestedParts: [],
    },
  })
  const bareWatch = await make("QUARTZ", "#555", {
    ...empty,
    description: "Appears to be a small quartz dress watch with a silver-tone case.",
    damageNotes: "The crown appears loose.",
    watch: {
      brand: "Unknown",
      model: "",
      referenceNo: "",
      caseSize: "",
      caseMaterial: "appears silver-tone",
      dial: "white",
      movementType: "quartz",
      caliber: "",
      confidence: "low",
      confidenceNote: "The caseback was not filmed.",
      needsCaseback: true,
      needsDial: false,
      visibleText: [],
      suggestedParts: [{ name: "Battery", partNumber: "", reason: "Quartz movement. Confirm the cell with the brand." }],
    },
  })
  const miriam = await make("BRACELET", "#888", { ...empty, description: "Appears to be a white gold line bracelet.", damageNotes: "The clasp appears loose." })
  const joseph = await make("WATCH", "#333", { ...empty, description: "Appears to be a round steel wristwatch.", damageNotes: "No damage is visible in these photos." })
  const sarah = await make("EARRINGS", "#c0a060", { ...empty, description: "Appears to be a pair of gold drop earrings.", damageNotes: "One hook appears stretched." })
  const david = await make("CHAIN", "#777", { ...empty, description: "Appears to be a yellow gold chain.", damageNotes: "A link appears open." })

  updateItem(ruth.id, {
    customerName: "Ruth Adler",
    customerPhone: "7185550142",
    customerAddress: "1842 47th St, Brooklyn, NY 11204",
    smsConsent: true,
    requestedRepair: "Resize to 6 and retip the prong",
    repairPrice: "185",
    deposit: "50",
    paymentStatus: "deposit",
    estimateReadyOn: new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10),
  })
  saveWatch(quoteWatch.id, {
    isWatch: true,
    brand: "Seiko",
    model: "5",
    referenceNo: "SNK809",
    serialNo: "",
    caseSize: "37 mm",
    caseMaterial: "appears stainless steel",
    dial: "black, day-date",
    movementType: "automatic",
    caliber: "7S26",
    confirmed: true,
  })
  updateItem(quoteWatch.id, {
    customerName: "Chaim Weiss",
    customerPhone: "7185550190",
    customerAddress: "501 13th Ave, Brooklyn, NY 11219",
    smsConsent: true,
    requestedRepair: "New crystal",
    repairPrice: "95",
    estimateReadyOn: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10),
  })
  updateItem(bareWatch.id, {
    customerName: "Leah Gross",
    customerPhone: "3475550114",
    customerAddress: "128 Maple St, Brooklyn, NY 11219",
    smsConsent: true,
    requestedRepair: "Service and new cell",
  })
  updateItem(miriam.id, {
    customerName: "Miriam Klein",
    customerPhone: "3475550198",
    customerAddress: "890 50th St, Brooklyn, NY 11219",
    smsConsent: true,
    requestedRepair: "Tighten the clasp",
    repairPrice: "240",
    estimateReadyOn: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
  })
  updateItem(joseph.id, {
    customerName: "Joseph Berg",
    customerPhone: "7185550166",
    customerAddress: "55 12th Ave, Brooklyn, NY 11219",
    smsConsent: true,
    requestedRepair: "Crystal and pressure test",
    repairPrice: "320",
    estimateReadyOn: new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10),
  })
  updateItem(sarah.id, {
    customerName: "Sarah Cohen",
    customerPhone: "9175550133",
    customerAddress: "2201 65th St, Brooklyn, NY 11204",
    smsConsent: true,
    requestedRepair: "New shepherd's hook",
    repairPrice: "150",
  })
  updateItem(david.id, {
    customerName: "David Friedman",
    customerPhone: "7185550177",
    customerAddress: "4510 14th Ave, Brooklyn, NY 11219",
    smsConsent: true,
    requestedRepair: "Solder a link",
    repairPrice: "80",
  })

  const db = getDb()
  const stamp = (id: string, status: string, createdDays: number, extra: Record<string, string | number | null> = {}) => {
    const created = daysAgo(createdDays)
    db.prepare(
      `UPDATE items SET status = ?, created_at = ?, updated_at = ?, status_changed_at = ?, quoted_at = ?, ready_at = ? WHERE id = ?`,
    ).run(status, created, created, extra.status_changed_at ?? created, extra.quoted_at ?? null, extra.ready_at ?? null, id)
  }
  stamp(ruth.id, "in_repair", 6, { quoted_at: daysAgo(5) })
  stamp(quoteWatch.id, "in_repair", 18, { quoted_at: daysAgo(16) })
  stamp(bareWatch.id, "awaiting_approval", 3, { quoted_at: daysAgo(3), status_changed_at: daysAgo(3) })
  db.prepare(`UPDATE items SET repair_price_cents = 12000, estimate_ready_on = ? WHERE id = ?`).run(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), bareWatch.id)
  stamp(miriam.id, "awaiting_approval", 14, { quoted_at: daysAgo(12), status_changed_at: daysAgo(12) })
  stamp(joseph.id, "ready", 50, { ready_at: daysAgo(40), quoted_at: daysAgo(48) })
  stamp(sarah.id, "ready", 410, { ready_at: daysAgo(400), quoted_at: daysAgo(408) })
  stamp(david.id, "ready", 430, { ready_at: daysAgo(420), quoted_at: daysAgo(425) })
  db.prepare(`UPDATE items SET notice_mailed_on = ?, notice_tracking = ? WHERE id = ?`).run(daysAgo(40).slice(0, 10), "9407 1111 1111 1111 1111 11", david.id)

  addTicketPart(quoteWatch.id, {
    partName: "Crystal",
    partNumber: "DEMO-7S26-CRYSTAL",
    qty: 1,
    unitCostCents: 1800,
    source: "catalog",
  })

  importCatalog([
    { brand: "Seiko", model: "5", referenceNo: "SNK809", caliber: "7S26", partName: "Crystal", partNumber: "DEMO-7S26-CRYSTAL", notes: "Demo number. Replace with Seiko's part number." },
    { brand: "Seiko", model: "5", referenceNo: "SNK809", caliber: "7S26", partName: "Crown", partNumber: "DEMO-7S26-CROWN", notes: "Demo number. Replace with Seiko's part number." },
    { brand: "Seiko", model: "5", referenceNo: "SNK809", caliber: "7S26", partName: "Stem", partNumber: "DEMO-7S26-STEM", notes: "Demo number. Replace with Seiko's part number." },
  ])

  db.prepare(`UPDATE items SET email = lower(replace(first_name || '.' || last_name, ' ', '')) || '@example.com', email_consent = 1, preferred_language = 'English' WHERE email = '' AND first_name != ''`).run()
  console.log("Seeded", ruth.ticketNumber, quoteWatch.ticketNumber, miriam.ticketNumber)
}

const isDirectRun = process.argv[1]?.includes("seed")
if (isDirectRun) {
  seedDemo(process.argv.includes("--reset")).catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
