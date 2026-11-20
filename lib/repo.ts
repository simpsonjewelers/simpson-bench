import { randomBytes, randomUUID } from "node:crypto"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"
import { catalogMatchesWatch, genericUnverifiedParts, type CatalogDraft, type SuggestedPart } from "./catalog"
import { dataDir, getDb } from "./db"
import { isApprovalReminder, isPickupReminder, milestoneFromKey } from "./decision"
import { balanceCents, daysBetween, formatTicket, fullName, mailingAddress, normalizePhone, parseDollars, shopDay, ticketStamp } from "./format"
import { computeLienStage, DEFAULT_SETTINGS, dueReminder, normalizeSettings, type LienStage, type ShopSettings } from "./policy"
import { IN_PROGRESS, isStatus, type StatusId } from "./statuses"
import { DEFAULT_TEMPLATES, type MessageTemplate, type TemplateKey } from "./templates"
import type {
  CallLog,
  CatalogPart,
  InternalNote,
  ItemSummary,
  MovementType,
  PaymentStatus,
  Photo,
  ReportRow,
  ShopItem,
  ShopMessage,
  StatusEvent,
  TicketPart,
  VisionStatus,
  WatchProfile,
} from "./types"
import type { VisionResult } from "./vision"

type Row = Record<string, unknown>

const photoUrl = (id: string, thumb = false) => `/api/photos/${id}${thumb ? "?size=thumb" : ""}`

export async function createFromIntake(input: {
  frames: { buffer: Buffer; timestampSec: number; sharpness: number }[]
  warning: string | null
  vision: VisionResult
}): Promise<ShopItem> {
  const id = randomUUID()
  const createdAt = new Date().toISOString()
  const db = getDb()
  const photos: { id: string; filePath: string; thumbPath: string; sortOrder: number; sharpness: number; timestampSec: number }[] = []
  for (let index = 0; index < input.frames.length; index += 1) {
    const photoId = randomUUID()
    const saved = await writePhoto(id, photoId, input.frames[index].buffer)
    photos.push({
      id: photoId,
      ...saved,
      sortOrder: index,
      sharpness: input.frames[index].sharpness,
      timestampSec: input.frames[index].timestampSec,
    })
  }
  const token = randomBytes(18).toString("hex")
  const day = shopDay()
  const insert = db.transaction(() => {
    db.prepare(`INSERT INTO counters(day, n) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET n = n + 1`).run(day)
    const counter = db.prepare(`SELECT n FROM counters WHERE day = ?`).get(day) as { n: number }
    const ticket = formatTicket(ticketStamp(day), counter.n)
    db.prepare(
      `INSERT INTO items (
        id, ticket_number, created_at, updated_at, status, status_changed_at,
        description, damage_notes, vision_status, vision_message, capture_warning, approval_token
      ) VALUES (?, ?, ?, ?, 'received', ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      ticket,
      createdAt,
      createdAt,
      createdAt,
      input.vision.description,
      input.vision.damageNotes,
      input.vision.status,
      input.vision.message,
      input.warning,
      token,
    )
    const photoInsert = db.prepare(
      `INSERT INTO photos (id, item_id, file_path, thumb_path, sort_order, sharpness, timestamp_sec)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    for (const photo of photos) {
      photoInsert.run(photo.id, id, photo.filePath, photo.thumbPath, photo.sortOrder, photo.sharpness, photo.timestampSec)
    }
    db.prepare(
      `INSERT INTO status_events (id, item_id, from_status, to_status, note, actor, created_at)
       VALUES (?, ?, NULL, 'received', 'Piece received. Profile opened.', 'system', ?)`,
    ).run(randomUUID(), id, createdAt)
    if (input.vision.watch) insertWatch(id, input.vision.watch, createdAt)
  })
  insert()
  return getItem(id)!
}

export function getItem(id: string): ShopItem | null {
  const db = getDb()
  const row = db.prepare(`SELECT * FROM items WHERE id = ? OR lower(ticket_number) = lower(?)`).get(id, id) as Row | undefined
  if (!row) return null
  return hydrate(row)
}

export function listItems(query = ""): ItemSummary[] {
  const db = getDb()
  const q = `%${query.trim().replace(/[%_]/g, "")}%`
  const rows = db
    .prepare(
      `SELECT * FROM items
       WHERE ? = '%%' OR ticket_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ? OR email LIKE ?
          OR requested_repair LIKE ? OR description LIKE ? OR damage_notes LIKE ?
       ORDER BY created_at DESC LIMIT 300`,
    )
    .all(q, q, q, q, q, q, q, q) as Row[]
  return rows.map((row) => summarize(row, thumbFor(String(row.id))))
}

export function updateItem(
  id: string,
  patch: {
    customerName?: string
    firstName?: string
    lastName?: string
    customerPhone?: string
    altPhone?: string
    email?: string
    customerAddress?: string
    street?: string
    apt?: string
    city?: string
    state?: string
    zip?: string
    preferredContact?: "text" | "call" | "email"
    preferredLanguage?: string
    smsConsent?: boolean
    emailConsent?: boolean
    heardAbout?: string
    customerNotes?: string
    requestedRepair?: string
    staffNotes?: string
    description?: string
    damageNotes?: string
    repairPrice?: string | null
    estimateReadyOn?: string | null
    deposit?: string | null
    paymentStatus?: PaymentStatus
  },
): ShopItem {
  const current = requireItem(id)
  let firstName = patch.firstName ?? current.firstName
  let lastName = patch.lastName ?? current.lastName
  if (!firstName && patch.customerName) {
    const [first, ...rest] = patch.customerName.split(" ")
    firstName = first
    lastName = rest.join(" ")
  }
  const phone = patch.customerPhone == null ? current.customerPhone : normalizePhone(patch.customerPhone) || patch.customerPhone.trim()
  const altPhone = patch.altPhone == null ? current.altPhone : normalizePhone(patch.altPhone) || patch.altPhone.trim()
  let street = patch.street ?? current.street
  const apt = patch.apt ?? current.apt
  let city = patch.city ?? current.city
  let state = patch.state ?? current.state
  let zip = patch.zip ?? current.zip
  if (!street && patch.customerAddress) {
    const bits = patch.customerAddress.split(",").map((part) => part.trim())
    street = bits[0] || ""
    city = city || bits[1] || ""
    const stateZip = (bits[2] || "").split(/\s+/).filter(Boolean)
    state = state || stateZip[0] || ""
    zip = zip || stateZip[1] || ""
  }
  const composed = mailingAddress({ street, apt, city, state, zip })
  const price = patch.repairPrice === undefined ? current.repairPriceCents : parseDollars(patch.repairPrice ?? "")
  const deposit = patch.deposit === undefined ? current.depositCents : parseDollars(patch.deposit ?? "") ?? 0
  const payment = patch.paymentStatus ?? current.paymentStatus
  const contact = patch.preferredContact ?? current.preferredContact
  getDb()
    .prepare(
      `UPDATE items SET customer_name = ?, first_name = ?, last_name = ?, customer_phone = ?, alt_phone = ?, email = ?,
        customer_address = ?, street = ?, apt = ?, city = ?, state = ?, zip = ?, preferred_contact = ?, preferred_language = ?,
        sms_consent = ?, email_consent = ?, heard_about = ?, customer_notes = ?,
        requested_repair = ?, staff_notes = ?, description = ?, damage_notes = ?,
        repair_price_cents = ?, estimate_ready_on = ?, deposit_cents = ?, payment_status = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      fullName(firstName, lastName) || patch.customerName || current.customerName,
      firstName,
      lastName,
      phone,
      altPhone,
      (patch.email ?? current.email).trim(),
      composed || patch.customerAddress || current.customerAddress,
      street,
      apt,
      city,
      state,
      zip,
      contact === "call" || contact === "email" ? contact : "text",
      patch.preferredLanguage ?? current.preferredLanguage,
      (patch.smsConsent ?? current.smsConsent) ? 1 : 0,
      (patch.emailConsent ?? current.emailConsent) ? 1 : 0,
      patch.heardAbout ?? current.heardAbout,
      patch.customerNotes ?? current.customerNotes,
      patch.requestedRepair ?? current.requestedRepair,
      patch.staffNotes ?? current.staffNotes,
      patch.description ?? current.description,
      patch.damageNotes ?? current.damageNotes,
      price,
      patch.estimateReadyOn === undefined ? current.estimateReadyOn : patch.estimateReadyOn || null,
      deposit,
      payment,
      new Date().toISOString(),
      current.id,
    )
  return getItem(current.id)!
}

export function setStatus(id: string, status: StatusId, note: string, actor = "staff", at = new Date().toISOString()): ShopItem {
  const item = requireItem(id)
  if (item.status === status) throw new Error("That is already the status.")
  const db = getDb()
  const quotedAt = status === "awaiting_approval" && !item.quotedAt ? at : item.quotedAt
  let readyAt = item.readyAt
  if (status === "ready" && !readyAt) readyAt = at
  if (["received", "inspecting", "awaiting_approval", "in_repair", "declined"].includes(status)) readyAt = status === "ready" ? readyAt : null
  const pickedUpAt = status === "picked_up" ? at : item.pickedUpAt
  db.prepare(
    `UPDATE items SET status = ?, status_changed_at = ?, updated_at = ?, quoted_at = ?, ready_at = ?, picked_up_at = ?,
      lien_stage = CASE WHEN ? = 'picked_up' THEN 'none' ELSE lien_stage END
     WHERE id = ?`,
  ).run(status, at, at, quotedAt, readyAt, pickedUpAt, status, item.id)
  db.prepare(
    `INSERT INTO status_events (id, item_id, from_status, to_status, note, actor, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(randomUUID(), item.id, item.status, status, note, actor, at)
  return getItem(item.id)!
}

export function addNote(id: string, body: string, author: string): ShopItem {
  const item = requireItem(id)
  const text = body.trim()
  if (!text) throw new Error("Write a note first.")
  getDb()
    .prepare(`INSERT INTO notes (id, item_id, body, author, created_at) VALUES (?, ?, ?, ?, ?)`)
    .run(randomUUID(), item.id, text, author.trim() || "Staff", new Date().toISOString())
  return getItem(item.id)!
}

export function addCall(id: string, outcome: string, note: string): ShopItem {
  const item = requireItem(id)
  getDb()
    .prepare(`INSERT INTO calls (id, item_id, outcome, note, created_at) VALUES (?, ?, ?, ?, ?)`)
    .run(randomUUID(), item.id, outcome, note.trim(), new Date().toISOString())
  return getItem(item.id)!
}

export function saveWatch(
  id: string,
  watch: {
    isWatch: boolean
    brand: string
    model: string
    referenceNo: string
    serialNo: string
    caseSize: string
    caseMaterial: string
    dial: string
    movementType: string
    caliber: string
    confirmed: boolean
  },
): ShopItem {
  const item = requireItem(id)
  const now = new Date().toISOString()
  const db = getDb()
  const existing = db.prepare(`SELECT item_id FROM watch_profiles WHERE item_id = ?`).get(item.id)
  if (!watch.isWatch) {
    if (existing) {
      db.prepare(
        `UPDATE watch_profiles SET is_watch = 0, confirmed = 0, updated_at = ? WHERE item_id = ?`,
      ).run(now, item.id)
    }
    return getItem(item.id)!
  }
  const fields = [
    watch.brand.trim(),
    watch.model.trim(),
    watch.referenceNo.trim(),
    watch.serialNo.trim(),
    watch.caseSize.trim(),
    watch.caseMaterial.trim(),
    watch.dial.trim(),
    watch.movementType.trim() || "unknown",
    watch.caliber.trim(),
    watch.confirmed ? 1 : 0,
    now,
    item.id,
  ]
  if (existing) {
    db.prepare(
      `UPDATE watch_profiles SET is_watch = 1, brand = ?, model = ?, reference_no = ?, serial_no = ?, case_size = ?,
        case_material = ?, dial = ?, movement_type = ?, caliber = ?, confirmed = ?, updated_at = ? WHERE item_id = ?`,
    ).run(...fields)
  } else {
    db.prepare(
      `INSERT INTO watch_profiles (
        item_id, is_watch, brand, model, reference_no, serial_no, case_size, case_material, dial, movement_type, caliber, confirmed, updated_at
      ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(item.id, ...fields.slice(0, -1))
  }
  return getItem(item.id)!
}

export function applyVision(id: string, vision: VisionResult): ShopItem {
  const item = requireItem(id)
  const now = new Date().toISOString()
  const db = getDb()
  db.prepare(
    `UPDATE items SET description = ?, damage_notes = ?, vision_status = ?, vision_message = ?, updated_at = ? WHERE id = ?`,
  ).run(vision.description, vision.damageNotes, vision.status, vision.message, now, item.id)
  if (vision.watch && !item.watch?.confirmed) {
    if (item.watch) {
      db.prepare(
        `UPDATE watch_profiles SET is_watch = 1, brand = ?, model = ?, reference_no = ?, case_size = ?, case_material = ?,
          dial = ?, movement_type = ?, caliber = ?, confidence = ?, confidence_note = ?, needs_caseback = ?, needs_dial = ?,
          visible_text = ?, suggested_parts = ?, updated_at = ? WHERE item_id = ?`,
      ).run(
        vision.watch.brand,
        vision.watch.model,
        vision.watch.referenceNo,
        vision.watch.caseSize,
        vision.watch.caseMaterial,
        vision.watch.dial,
        vision.watch.movementType,
        vision.watch.caliber,
        vision.watch.confidence,
        vision.watch.confidenceNote,
        vision.watch.needsCaseback ? 1 : 0,
        vision.watch.needsDial ? 1 : 0,
        JSON.stringify(vision.watch.visibleText),
        JSON.stringify(vision.watch.suggestedParts),
        now,
        item.id,
      )
    } else {
      insertWatch(item.id, vision.watch, now)
    }
  } else if (vision.watch && item.watch) {
    db.prepare(`UPDATE watch_profiles SET suggested_parts = ?, updated_at = ? WHERE item_id = ?`).run(
      JSON.stringify(vision.watch.suggestedParts),
      now,
      item.id,
    )
  }
  return getItem(item.id)!
}

export function listCatalog(query = ""): CatalogPart[] {
  const q = `%${query.trim().replace(/[%_]/g, "")}%`
  const rows = getDb()
    .prepare(
      `SELECT * FROM parts_catalog
       WHERE ? = '%%' OR brand LIKE ? OR model LIKE ? OR reference_no LIKE ? OR caliber LIKE ? OR part_name LIKE ? OR part_number LIKE ?
       ORDER BY brand, reference_no, model, part_name`,
    )
    .all(q, q, q, q, q, q, q) as Row[]
  return rows.map(mapCatalog)
}

export function saveCatalogPart(input: CatalogDraft & { id?: string }): CatalogPart {
  if (!input.brand.trim() || !input.partName.trim() || !input.partNumber.trim()) {
    throw new Error("Brand, part name, and manufacturer part number are required.")
  }
  const now = new Date().toISOString()
  const db = getDb()
  if (input.id) {
    db.prepare(
      `UPDATE parts_catalog SET brand = ?, model = ?, reference_no = ?, caliber = ?, part_name = ?, part_number = ?, notes = ?, updated_at = ? WHERE id = ?`,
    ).run(input.brand.trim(), input.model.trim(), input.referenceNo.trim(), input.caliber.trim(), input.partName.trim(), input.partNumber.trim(), input.notes.trim(), now, input.id)
    return mapCatalog(db.prepare(`SELECT * FROM parts_catalog WHERE id = ?`).get(input.id) as Row)
  }
  const id = randomUUID()
  db.prepare(
    `INSERT INTO parts_catalog (id, brand, model, reference_no, caliber, part_name, part_number, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, input.brand.trim(), input.model.trim(), input.referenceNo.trim(), input.caliber.trim(), input.partName.trim(), input.partNumber.trim(), input.notes.trim(), now, now)
  return mapCatalog(db.prepare(`SELECT * FROM parts_catalog WHERE id = ?`).get(id) as Row)
}

export function deleteCatalogPart(id: string): void {
  getDb().prepare(`DELETE FROM parts_catalog WHERE id = ?`).run(id)
}

export function importCatalog(rows: CatalogDraft[]): { imported: number; skipped: number } {
  const db = getDb()
  const find = db.prepare(
    `SELECT id FROM parts_catalog WHERE lower(brand) = lower(?) AND lower(reference_no) = lower(?) AND lower(model) = lower(?)
      AND lower(caliber) = lower(?) AND lower(part_number) = lower(?)`,
  )
  const insert = db.prepare(
    `INSERT INTO parts_catalog (id, brand, model, reference_no, caliber, part_name, part_number, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  let imported = 0
  let skipped = 0
  const now = new Date().toISOString()
  const tx = db.transaction(() => {
    for (const row of rows) {
      if (find.get(row.brand, row.referenceNo, row.model, row.caliber, row.partNumber)) {
        skipped += 1
        continue
      }
      insert.run(randomUUID(), row.brand, row.model, row.referenceNo, row.caliber, row.partName, row.partNumber, row.notes, now, now)
      imported += 1
    }
  })
  tx()
  return { imported, skipped }
}

export function addTicketPart(
  id: string,
  input: { partName: string; partNumber: string; qty: number; unitCostCents: number; source: TicketPart["source"] },
): ShopItem {
  const item = requireItem(id)
  if (!input.partName.trim()) throw new Error("Name the part.")
  const qty = Number(input.qty)
  if (!Number.isFinite(qty) || qty <= 0) throw new Error("Quantity needs to be at least 1.")
  getDb()
    .prepare(
      `INSERT INTO ticket_parts (id, item_id, part_name, part_number, qty, unit_cost_cents, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(randomUUID(), item.id, input.partName.trim(), input.partNumber.trim(), qty, Math.max(0, Math.round(input.unitCostCents)), input.source, new Date().toISOString())
  return getItem(item.id)!
}

export function deleteTicketPart(itemId: string, partId: string): ShopItem {
  const item = requireItem(itemId)
  getDb().prepare(`DELETE FROM ticket_parts WHERE id = ? AND item_id = ?`).run(partId, item.id)
  return getItem(item.id)!
}

export function getTemplates(): MessageTemplate[] {
  ensureTemplates()
  const rows = getDb().prepare(`SELECT key, label, body FROM templates ORDER BY key`).all() as { key: TemplateKey; label: string; body: string }[]
  const order = DEFAULT_TEMPLATES.map((template) => template.key)
  return rows.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
}

export function saveTemplates(templates: { key: string; body: string }[]): MessageTemplate[] {
  ensureTemplates()
  const db = getDb()
  const update = db.prepare(`UPDATE templates SET body = ?, updated_at = ? WHERE key = ?`)
  const now = new Date().toISOString()
  const tx = db.transaction(() => {
    for (const template of templates) {
      update.run(template.body, now, template.key)
    }
  })
  tx()
  return getTemplates()
}

export function templateBody(key: string): string {
  ensureTemplates()
  const row = getDb().prepare(`SELECT body FROM templates WHERE key = ?`).get(key) as { body: string } | undefined
  return row?.body ?? DEFAULT_TEMPLATES.find((template) => template.key === key)?.body ?? ""
}

export function getSettings(): ShopSettings {
  const row = getDb().prepare(`SELECT value FROM settings WHERE key = 'shop'`).get() as { value: string } | undefined
  if (!row) {
    getDb().prepare(`INSERT INTO settings (key, value) VALUES ('shop', ?)`).run(JSON.stringify(DEFAULT_SETTINGS))
    return DEFAULT_SETTINGS
  }
  try {
    return normalizeSettings(JSON.parse(row.value) as ShopSettings)
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(input: Partial<ShopSettings>): ShopSettings {
  const next = normalizeSettings({ ...getSettings(), ...input })
  getDb().prepare(`INSERT INTO settings (key, value) VALUES ('shop', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(JSON.stringify(next))
  return next
}

export function addMessage(input: {
  itemId: string
  direction: "outbound" | "inbound"
  body: string
  toPhone?: string | null
  fromPhone?: string | null
  templateKey?: string | null
  status: string
  delivery?: string | null
  twilioSid?: string | null
  error?: string | null
  createdAt?: string
}): void {
  getDb()
    .prepare(
      `INSERT INTO messages (id, item_id, direction, body, to_phone, from_phone, template_key, status, delivery, twilio_sid, error, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      randomUUID(),
      input.itemId,
      input.direction,
      input.body,
      input.toPhone ?? null,
      input.fromPhone ?? null,
      input.templateKey ?? null,
      input.status,
      input.delivery ?? null,
      input.twilioSid ?? null,
      input.error ?? null,
      input.createdAt ?? new Date().toISOString(),
    )
}

export function hasMessageSid(sid: string): boolean {
  if (!sid) return false
  return Boolean(getDb().prepare(`SELECT id FROM messages WHERE twilio_sid = ?`).get(sid))
}

export function updateDelivery(sid: string, delivery: string, error: string | null): void {
  getDb().prepare(`UPDATE messages SET delivery = ?, error = COALESCE(?, error) WHERE twilio_sid = ?`).run(delivery, error, sid)
}

export function logMailing(id: string, mailedOn: string, tracking: string): ShopItem {
  const item = requireItem(id)
  if (!item.customerAddress.trim()) {
    throw new Error("Add the customer's mailing address before logging the notice. If the address is unknown, §186 allows posting instead of mailing — record that in the tracking note.")
  }
  const now = new Date().toISOString()
  getDb().prepare(`UPDATE items SET notice_mailed_on = ?, notice_tracking = ?, updated_at = ? WHERE id = ?`).run(mailedOn, tracking.trim(), now, item.id)
  getDb()
    .prepare(`INSERT INTO status_events (id, item_id, from_status, to_status, note, actor, created_at) VALUES (?, ?, ?, ?, ?, 'staff', ?)`)
    .run(randomUUID(), item.id, item.status, item.status, `§186 notice mailed ${mailedOn}. Tracking: ${tracking.trim() || "none"}`, now)
  return getItem(item.id)!
}

export function recordSale(id: string, input: { saleOn: string; priceCents: number; expensesCents: number; note: string }): ShopItem {
  const item = requireItem(id)
  const now = new Date().toISOString()
  getDb()
    .prepare(
      `UPDATE items SET status = 'sold', lien_stage = 'sold', sale_on = ?, sale_price_cents = ?, sale_expenses_cents = ?, sale_note = ?,
        status_changed_at = ?, updated_at = ? WHERE id = ?`,
    )
    .run(input.saleOn, input.priceCents, input.expensesCents, input.note.trim(), now, now, item.id)
  getDb()
    .prepare(`INSERT INTO status_events (id, item_id, from_status, to_status, note, actor, created_at) VALUES (?, ?, ?, 'sold', ?, 'staff', ?)`)
    .run(randomUUID(), item.id, item.status, input.note.trim() || "Sale recorded.", now)
  return getItem(item.id)!
}

export async function saveSignature(id: string, png: Buffer): Promise<ShopItem> {
  const item = requireItem(id)
  const relative = path.join("items", item.id, "signature.png")
  const absolute = path.join(dataDir(), relative)
  await mkdir(path.dirname(absolute), { recursive: true })
  await writeFile(absolute, png)
  const now = new Date().toISOString()
  getDb().prepare(`UPDATE items SET signature_path = ?, updated_at = ? WHERE id = ?`).run(relative, now, item.id)
  return getItem(item.id)!
}

export function findAwaitingByPhone(phone: string): ShopItem | null {
  const row = getDb()
    .prepare(`SELECT * FROM items WHERE customer_phone = ? AND status = 'awaiting_approval' ORDER BY updated_at DESC LIMIT 1`)
    .get(phone) as Row | undefined
  return row ? hydrate(row) : null
}

export function findLatestByPhone(phone: string): ShopItem | null {
  const row = getDb()
    .prepare(`SELECT * FROM items WHERE customer_phone = ? ORDER BY updated_at DESC LIMIT 1`)
    .get(phone) as Row | undefined
  return row ? hydrate(row) : null
}

export function findByApprovalToken(token: string): ShopItem | null {
  const row = getDb().prepare(`SELECT * FROM items WHERE approval_token = ?`).get(token) as Row | undefined
  return row ? hydrate(row) : null
}

export function findByTicket(ticket: string): ShopItem | null {
  const row = getDb().prepare(`SELECT * FROM items WHERE lower(ticket_number) = lower(?)`).get(ticket.trim()) as Row | undefined
  return row ? hydrate(row) : null
}

export function rateLimited(ip: string, limit = 8, windowMs = 10 * 60 * 1000): boolean {
  const db = getDb()
  const now = Date.now()
  db.prepare(`DELETE FROM lookup_hits WHERE created_at < ?`).run(now - windowMs)
  const row = db.prepare(`SELECT COUNT(*) AS n FROM lookup_hits WHERE ip = ?`).get(ip) as { n: number }
  if (row.n >= limit) return true
  db.prepare(`INSERT INTO lookup_hits (ip, created_at) VALUES (?, ?)`).run(ip, now)
  return false
}

export function reportRows(kind: "in-progress" | "awaiting" | "pickup" | "risk" | "queue", pickupDays = 30): ReportRow[] {
  const settings = getSettings()
  const rows = getDb().prepare(`SELECT * FROM items ORDER BY created_at ASC`).all() as Row[]
  const ids = rows.map((row) => String(row.id))
  const extras = loadExtras(ids)
  const today = shopDay()
  const result: ReportRow[] = []
  for (const row of rows) {
    const id = String(row.id)
    syncLienRow(row)
    const status = String(row.status) as StatusId
    const readyAt = textOrNull(row.ready_at)
    const quotedAt = textOrNull(row.quoted_at)
    const estimate = textOrNull(row.estimate_ready_on)
    const messages = extras.messages.get(id) ?? []
    const calls = extras.calls.get(id) ?? []
    const daysInShop = daysBetween(String(row.created_at))
    const daysSinceReady = readyAt ? daysBetween(readyAt) : null
    const daysWaiting = quotedAt ? daysBetween(quotedAt) : status === "awaiting_approval" ? daysBetween(String(row.status_changed_at)) : null
    const followups = messages.filter((message) => isApprovalReminder(message.templateKey)).length
    const reminders = messages.filter((message) => isPickupReminder(message.templateKey)).length
    const sentMilestones = messages.map((message) => milestoneFromKey(message.templateKey)).filter((day): day is number => day != null)
    const dueMilestone = status === "ready" && daysSinceReady != null ? dueReminder(daysSinceReady, sentMilestones, settings.reminderDays) : null
    const lastTimes = [...messages.map((message) => message.createdAt), ...calls.map((call) => call.createdAt)].sort()
    const price = row.repair_price_cents == null ? null : Number(row.repair_price_cents)
    const summary: ReportRow = {
      ...summarize(row, extras.thumbs.get(id) ?? null),
      customerAddress: String(row.customer_address ?? ""),
      daysWaiting,
      daysSinceReady,
      balanceCents: balanceCents({
        repairPriceCents: price,
        depositCents: Number(row.deposit_cents ?? 0),
        paymentStatus: String(row.payment_status ?? "unpaid"),
      }),
      followups,
      reminders,
      lastContactAt: lastTimes.at(-1) ?? null,
      dueMilestone,
      noticeMailedOn: textOrNull(row.notice_mailed_on),
      noticeTracking: textOrNull(row.notice_tracking),
      daysInShop,
      overdue: Boolean(estimate && estimate < today && (IN_PROGRESS as string[]).includes(status)),
    }
    const lien = String(row.lien_stage)
    if (kind === "in-progress" && (IN_PROGRESS as string[]).includes(status)) result.push(summary)
    if (kind === "awaiting" && status === "awaiting_approval") result.push(summary)
    if (kind === "pickup" && status === "ready" && (daysSinceReady ?? 0) >= pickupDays) result.push(summary)
    if (kind === "risk" && ["at_risk", "eligible_notice", "notice_mailed", "eligible_sale", "sold"].includes(lien)) result.push(summary)
    if (kind === "queue" && dueMilestone != null) result.push(summary)
  }
  return result
}

export function matchCustomers(query: string): ShopItem[] {
  const raw = query.trim()
  if (raw.length < 3) return []
  const phone = normalizePhone(raw)
  const digits = raw.replace(/\D/g, "")
  const email = raw.includes("@") ? raw.toLowerCase() : ""
  const rows = getDb().prepare("SELECT * FROM items ORDER BY updated_at DESC LIMIT 400").all() as Row[]
  const seen = new Set<string>()
  const matches: ShopItem[] = []
  for (const row of rows) {
    const itemPhone = String(row.customer_phone ?? "")
    const itemAlt = String(row.alt_phone ?? "")
    const itemEmail = String(row.email ?? "").toLowerCase()
    const phoneHit = Boolean(phone && (itemPhone === phone || itemAlt === phone))
    const digitHit = digits.length >= 7 && (itemPhone.replace(/\D/g, "").endsWith(digits) || itemAlt.replace(/\D/g, "").endsWith(digits))
    const emailHit = Boolean(email && itemEmail === email)
    if (!phoneHit && !digitHit && !emailHit) continue
    const key = itemPhone || itemEmail
    if (!key || seen.has(key)) continue
    seen.add(key)
    matches.push(hydrate(row))
    if (matches.length >= 4) break
  }
  return matches
}

export function customerGroups(): {
  phone: string
  name: string
  visits: { id: string; ticketNumber: string; createdAt: string; status: string; requestedRepair: string }[]
}[] {
  const rows = getDb().prepare(`SELECT * FROM items WHERE customer_phone != '' ORDER BY created_at DESC`).all() as Row[]
  const groups = new Map<string, { phone: string; name: string; visits: { id: string; ticketNumber: string; createdAt: string; status: string; requestedRepair: string }[] }>()
  for (const row of rows) {
    const phone = String(row.customer_phone)
    const group = groups.get(phone) ?? { phone, name: "", visits: [] }
    if (!group.name && row.customer_name) group.name = String(row.customer_name)
    group.visits.push({
      id: String(row.id),
      ticketNumber: String(row.ticket_number),
      createdAt: String(row.created_at),
      status: String(row.status),
      requestedRepair: String(row.requested_repair ?? ""),
    })
    groups.set(phone, group)
  }
  return [...groups.values()]
}

export async function readPhoto(id: string, size: "full" | "thumb"): Promise<Buffer | null> {
  const row = getDb().prepare(`SELECT file_path, thumb_path FROM photos WHERE id = ?`).get(id) as Row | undefined
  if (!row) return null
  const relative = String(size === "thumb" ? row.thumb_path : row.file_path)
  return readFile(safePath(relative))
}

export async function readSignature(id: string): Promise<Buffer | null> {
  const row = getDb().prepare(`SELECT signature_path FROM items WHERE id = ?`).get(id) as Row | undefined
  if (!row?.signature_path) return null
  return readFile(safePath(String(row.signature_path)))
}

export async function resetAllData(): Promise<void> {
  const db = getDb()
  db.exec(`
    DELETE FROM ticket_parts;
    DELETE FROM watch_profiles;
    DELETE FROM calls;
    DELETE FROM notes;
    DELETE FROM messages;
    DELETE FROM status_events;
    DELETE FROM photos;
    DELETE FROM items;
    DELETE FROM parts_catalog;
    DELETE FROM counters;
    DELETE FROM lookup_hits;
  `)
  await rm(path.join(dataDir(), "items"), { recursive: true, force: true })
}

function hydrate(row: Row): ShopItem {
  syncLienRow(row)
  const id = String(row.id)
  const db = getDb()
  const photos = (db.prepare(`SELECT * FROM photos WHERE item_id = ? ORDER BY sort_order`).all(id) as Row[]).map(mapPhoto)
  const events = (db.prepare(`SELECT * FROM status_events WHERE item_id = ? ORDER BY created_at`).all(id) as Row[]).map(mapEvent)
  const messages = (db.prepare(`SELECT * FROM messages WHERE item_id = ? ORDER BY created_at`).all(id) as Row[]).map(mapMessage)
  const notes = (db.prepare(`SELECT * FROM notes WHERE item_id = ? ORDER BY created_at DESC`).all(id) as Row[]).map(mapNote)
  const calls = (db.prepare(`SELECT * FROM calls WHERE item_id = ? ORDER BY created_at DESC`).all(id) as Row[]).map(mapCall)
  const watchRow = db.prepare(`SELECT * FROM watch_profiles WHERE item_id = ?`).get(id) as Row | undefined
  const watch = watchRow && Number(watchRow.is_watch) ? mapWatch(watchRow) : null
  const catalog = watch ? allCatalog().filter((part) => catalogMatchesWatch(part, watch)) : []
  const ticketParts = (db.prepare(`SELECT * FROM ticket_parts WHERE item_id = ? ORDER BY created_at`).all(id) as Row[]).map(mapTicketPart)
  const phone = String(row.customer_phone ?? "")
  const related = phone
    ? (db.prepare(`SELECT id, ticket_number, created_at, status, customer_name, requested_repair FROM items WHERE customer_phone = ? AND id != ? ORDER BY created_at DESC`).all(phone, id) as Row[]).map((relatedRow) => ({
        id: String(relatedRow.id),
        ticketNumber: String(relatedRow.ticket_number),
        createdAt: String(relatedRow.created_at),
        status: String(relatedRow.status),
        customerName: String(relatedRow.customer_name ?? ""),
        requestedRepair: String(relatedRow.requested_repair ?? ""),
      }))
    : []
  const partsSource = !watch ? "none" : catalog.length ? "catalog" : "unverified"
  return {
    ...baseItem(row),
    photos,
    events,
    messages,
    notes,
    calls,
    watch,
    catalogParts: catalog,
    ticketParts,
    partsSource,
    related,
  }
}

function baseItem(row: Row): Omit<ShopItem, "photos" | "events" | "messages" | "notes" | "calls" | "watch" | "catalogParts" | "ticketParts" | "partsSource" | "related"> {
  const status = String(row.status)
  return {
    id: String(row.id),
    ticketNumber: String(row.ticket_number),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    status: isStatus(status) ? status : "received",
    statusChangedAt: String(row.status_changed_at),
    customerName: String(row.customer_name ?? ""),
    firstName: String(row.first_name ?? ""),
    lastName: String(row.last_name ?? ""),
    customerPhone: String(row.customer_phone ?? ""),
    altPhone: String(row.alt_phone ?? ""),
    email: String(row.email ?? ""),
    customerAddress: String(row.customer_address ?? ""),
    street: String(row.street ?? ""),
    apt: String(row.apt ?? ""),
    city: String(row.city ?? ""),
    state: String(row.state ?? ""),
    zip: String(row.zip ?? ""),
    preferredContact: (["text", "call", "email"].includes(String(row.preferred_contact)) ? String(row.preferred_contact) : "text") as "text" | "call" | "email",
    preferredLanguage: String(row.preferred_language ?? "English"),
    smsConsent: Boolean(row.sms_consent),
    emailConsent: Boolean(row.email_consent),
    heardAbout: String(row.heard_about ?? ""),
    customerNotes: String(row.customer_notes ?? ""),
    requestedRepair: String(row.requested_repair ?? ""),
    staffNotes: String(row.staff_notes ?? ""),
    description: String(row.description ?? ""),
    damageNotes: String(row.damage_notes ?? ""),
    visionStatus: (String(row.vision_status) as VisionStatus) || "no_key",
    visionMessage: textOrNull(row.vision_message),
    captureWarning: textOrNull(row.capture_warning),
    repairPriceCents: row.repair_price_cents == null ? null : Number(row.repair_price_cents),
    estimateReadyOn: textOrNull(row.estimate_ready_on),
    depositCents: Number(row.deposit_cents ?? 0),
    paymentStatus: (String(row.payment_status) as PaymentStatus) || "unpaid",
    approvalToken: String(row.approval_token),
    quotedAt: textOrNull(row.quoted_at),
    readyAt: textOrNull(row.ready_at),
    pickedUpAt: textOrNull(row.picked_up_at),
    signatureUrl: row.signature_path ? `/api/items/${row.id}/signature` : null,
    lienStage: String(row.lien_stage) as LienStage,
    noticeMailedOn: textOrNull(row.notice_mailed_on),
    noticeTracking: textOrNull(row.notice_tracking),
    saleOn: textOrNull(row.sale_on),
    salePriceCents: row.sale_price_cents == null ? null : Number(row.sale_price_cents),
    saleExpensesCents: row.sale_expenses_cents == null ? null : Number(row.sale_expenses_cents),
    saleNote: textOrNull(row.sale_note),
  }
}

function summarize(row: Row, thumbId: string | null): ItemSummary {
  const status = String(row.status)
  const estimate = textOrNull(row.estimate_ready_on)
  return {
    id: String(row.id),
    ticketNumber: String(row.ticket_number),
    createdAt: String(row.created_at),
    status: isStatus(status) ? status : "received",
    customerName: String(row.customer_name ?? ""),
    customerPhone: String(row.customer_phone ?? ""),
    description: String(row.description ?? ""),
    requestedRepair: String(row.requested_repair ?? ""),
    repairPriceCents: row.repair_price_cents == null ? null : Number(row.repair_price_cents),
    estimateReadyOn: estimate,
    quotedAt: textOrNull(row.quoted_at),
    readyAt: textOrNull(row.ready_at),
    lienStage: String(row.lien_stage || "none") as LienStage,
    thumbUrl: thumbId ? photoUrl(thumbId, true) : null,
    daysInShop: daysBetween(String(row.created_at)),
    overdue: Boolean(estimate && estimate < shopDay() && (IN_PROGRESS as string[]).includes(status)),
  }
}

function syncLienRow(row: Row): void {
  const settings = getSettings()
  const next = computeLienStage(
    {
      status: String(row.status),
      readyAt: textOrNull(row.ready_at),
      noticeMailedOn: textOrNull(row.notice_mailed_on),
      lienStage: String(row.lien_stage ?? "none"),
      paymentStatus: String(row.payment_status ?? "unpaid"),
    },
    settings,
  )
  if (next !== row.lien_stage) {
    getDb().prepare(`UPDATE items SET lien_stage = ? WHERE id = ?`).run(next, row.id)
    row.lien_stage = next
  }
}

function loadExtras(ids: string[]) {
  const messages = new Map<string, { templateKey: string | null; createdAt: string }[]>()
  const calls = new Map<string, { createdAt: string }[]>()
  const thumbs = new Map<string, string>()
  if (!ids.length) return { messages, calls, thumbs }
  const marks = ids.map(() => "?").join(",")
  const db = getDb()
  for (const row of db.prepare(`SELECT item_id, template_key, created_at FROM messages WHERE item_id IN (${marks})`).all(...ids) as Row[]) {
    const list = messages.get(String(row.item_id)) ?? []
    list.push({ templateKey: textOrNull(row.template_key), createdAt: String(row.created_at) })
    messages.set(String(row.item_id), list)
  }
  for (const row of db.prepare(`SELECT item_id, created_at FROM calls WHERE item_id IN (${marks})`).all(...ids) as Row[]) {
    const list = calls.get(String(row.item_id)) ?? []
    list.push({ createdAt: String(row.created_at) })
    calls.set(String(row.item_id), list)
  }
  for (const row of db.prepare(`SELECT item_id, id FROM photos WHERE item_id IN (${marks}) ORDER BY sort_order`).all(...ids) as Row[]) {
    const itemId = String(row.item_id)
    if (!thumbs.has(itemId)) thumbs.set(itemId, String(row.id))
  }
  return { messages, calls, thumbs }
}

function allCatalog(): CatalogPart[] {
  return (getDb().prepare(`SELECT * FROM parts_catalog`).all() as Row[]).map(mapCatalog)
}

function thumbFor(itemId: string): string | null {
  const row = getDb().prepare(`SELECT id FROM photos WHERE item_id = ? ORDER BY sort_order LIMIT 1`).get(itemId) as Row | undefined
  return row ? String(row.id) : null
}

function mapPhoto(row: Row): Photo {
  const id = String(row.id)
  return {
    id,
    url: photoUrl(id),
    thumbUrl: photoUrl(id, true),
    sortOrder: Number(row.sort_order ?? 0),
    sharpness: Number(row.sharpness ?? 0),
    timestampSec: Number(row.timestamp_sec ?? 0),
  }
}

function mapEvent(row: Row): StatusEvent {
  return {
    id: String(row.id),
    fromStatus: textOrNull(row.from_status),
    toStatus: String(row.to_status),
    note: String(row.note ?? ""),
    actor: String(row.actor ?? "staff"),
    createdAt: String(row.created_at),
  }
}

function mapMessage(row: Row): ShopMessage {
  return {
    id: String(row.id),
    direction: String(row.direction) === "inbound" ? "inbound" : "outbound",
    body: String(row.body ?? ""),
    toPhone: textOrNull(row.to_phone),
    fromPhone: textOrNull(row.from_phone),
    templateKey: textOrNull(row.template_key),
    status: String(row.status ?? ""),
    delivery: textOrNull(row.delivery),
    error: textOrNull(row.error),
    createdAt: String(row.created_at),
  }
}

function mapNote(row: Row): InternalNote {
  return { id: String(row.id), body: String(row.body ?? ""), author: String(row.author ?? "Staff"), createdAt: String(row.created_at) }
}

function mapCall(row: Row): CallLog {
  return { id: String(row.id), outcome: String(row.outcome ?? ""), note: String(row.note ?? ""), createdAt: String(row.created_at) }
}

function mapWatch(row: Row): WatchProfile {
  return {
    isWatch: Boolean(row.is_watch),
    brand: String(row.brand ?? ""),
    model: String(row.model ?? ""),
    referenceNo: String(row.reference_no ?? ""),
    serialNo: String(row.serial_no ?? ""),
    caseSize: String(row.case_size ?? ""),
    caseMaterial: String(row.case_material ?? ""),
    dial: String(row.dial ?? ""),
    movementType: (String(row.movement_type ?? "unknown") as MovementType) || "unknown",
    caliber: String(row.caliber ?? ""),
    confidence: String(row.confidence ?? ""),
    confidenceNote: String(row.confidence_note ?? ""),
    needsCaseback: Boolean(row.needs_caseback),
    needsDial: Boolean(row.needs_dial),
    visibleText: parseJson<string[]>(String(row.visible_text ?? "[]"), []),
    suggestedParts: parseJson<SuggestedPart[]>(String(row.suggested_parts ?? "[]"), []),
    confirmed: Boolean(row.confirmed),
  }
}

function mapCatalog(row: Row): CatalogPart {
  return {
    id: String(row.id),
    brand: String(row.brand ?? ""),
    model: String(row.model ?? ""),
    referenceNo: String(row.reference_no ?? ""),
    caliber: String(row.caliber ?? ""),
    partName: String(row.part_name ?? ""),
    partNumber: String(row.part_number ?? ""),
    notes: String(row.notes ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  }
}

function mapTicketPart(row: Row): TicketPart {
  const source = String(row.source ?? "manual")
  return {
    id: String(row.id),
    partName: String(row.part_name ?? ""),
    partNumber: String(row.part_number ?? ""),
    qty: Number(row.qty ?? 1),
    unitCostCents: Number(row.unit_cost_cents ?? 0),
    source: source === "catalog" || source === "unverified" ? source : "manual",
    createdAt: String(row.created_at),
  }
}

function insertWatch(itemId: string, watch: NonNullable<VisionResult["watch"]>, now: string) {
  getDb()
    .prepare(
      `INSERT INTO watch_profiles (
        item_id, is_watch, brand, model, reference_no, case_size, case_material, dial, movement_type, caliber,
        confidence, confidence_note, needs_caseback, needs_dial, visible_text, suggested_parts, confirmed, updated_at
      ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    )
    .run(
      itemId,
      watch.brand,
      watch.model,
      watch.referenceNo,
      watch.caseSize,
      watch.caseMaterial,
      watch.dial,
      watch.movementType,
      watch.caliber,
      watch.confidence,
      watch.confidenceNote,
      watch.needsCaseback ? 1 : 0,
      watch.needsDial ? 1 : 0,
      JSON.stringify(watch.visibleText),
      JSON.stringify(watch.suggestedParts),
      now,
    )
}

function ensureTemplates() {
  const db = getDb()
  const count = db.prepare(`SELECT COUNT(*) AS n FROM templates`).get() as { n: number }
  if (count.n > 0) return
  const insert = db.prepare(`INSERT INTO templates (key, label, body, updated_at) VALUES (?, ?, ?, ?)`)
  const now = new Date().toISOString()
  const tx = db.transaction(() => {
    for (const template of DEFAULT_TEMPLATES) insert.run(template.key, template.label, template.body, now)
  })
  tx()
}

function requireItem(id: string): ShopItem {
  const item = getItem(id)
  if (!item) throw new Error("That ticket is not on the bench.")
  return item
}

function textOrNull(value: unknown): string | null {
  if (value == null || value === "") return null
  return String(value)
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

async function writePhoto(itemId: string, photoId: string, buffer: Buffer) {
  const dir = path.join(dataDir(), "items", itemId)
  await mkdir(dir, { recursive: true })
  const full = await sharp(buffer).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer()
  const thumb = await sharp(full).resize(480, 480, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 76 }).toBuffer()
  const filePath = path.join("items", itemId, `${photoId}.jpg`)
  const thumbPath = path.join("items", itemId, `${photoId}-thumb.jpg`)
  await writeFile(path.join(dataDir(), filePath), full)
  await writeFile(path.join(dataDir(), thumbPath), thumb)
  return { filePath, thumbPath }
}

function safePath(relative: string): string {
  const root = path.resolve(dataDir())
  const full = path.resolve(root, relative)
  if (!full.startsWith(root)) throw new Error("Bad photo path.")
  return full
}

export function unverifiedPartsFor(item: ShopItem): SuggestedPart[] {
  if (!item.watch?.isWatch || item.catalogParts.length) return []
  if (item.watch.suggestedParts.length) return item.watch.suggestedParts
  return genericUnverifiedParts(item.watch.movementType)
}
