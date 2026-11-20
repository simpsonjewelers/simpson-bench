import Database from "better-sqlite3"
import { mkdirSync } from "node:fs"
import path from "node:path"

const globalDb = globalThis as unknown as { simpsonDb?: Database.Database }

export function dataDir(): string {
  return process.env.DATA_DIR || path.join(process.cwd(), "data")
}

export function getDb(): Database.Database {
  if (!globalDb.simpsonDb) {
    mkdirSync(dataDir(), { recursive: true })
    const db = new Database(path.join(dataDir(), "bench.db"))
    db.pragma("journal_mode = WAL")
    db.pragma("busy_timeout = 5000")
    db.pragma("foreign_keys = ON")
    db.exec(SCHEMA)
    globalDb.simpsonDb = db
  }
  migrateItems(globalDb.simpsonDb)
  return globalDb.simpsonDb
}

export function closeDb(): void {
  globalDb.simpsonDb?.close()
  globalDb.simpsonDb = undefined
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS counters (
  day TEXT PRIMARY KEY,
  n INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  ticket_number TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL,
  status_changed_at TEXT NOT NULL,
  customer_name TEXT NOT NULL DEFAULT '',
  customer_phone TEXT NOT NULL DEFAULT '',
  customer_address TEXT NOT NULL DEFAULT '',
  sms_consent INTEGER NOT NULL DEFAULT 0,
  requested_repair TEXT NOT NULL DEFAULT '',
  staff_notes TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  damage_notes TEXT NOT NULL DEFAULT '',
  vision_status TEXT NOT NULL DEFAULT 'no_key',
  vision_message TEXT,
  capture_warning TEXT,
  repair_price_cents INTEGER,
  estimate_ready_on TEXT,
  deposit_cents INTEGER NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  approval_token TEXT NOT NULL,
  quoted_at TEXT,
  ready_at TEXT,
  picked_up_at TEXT,
  signature_path TEXT,
  lien_stage TEXT NOT NULL DEFAULT 'none',
  notice_mailed_on TEXT,
  notice_tracking TEXT,
  sale_on TEXT,
  sale_price_cents INTEGER,
  sale_expenses_cents INTEGER,
  sale_note TEXT
);
CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  thumb_path TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  sharpness REAL,
  timestamp_sec REAL
);
CREATE TABLE IF NOT EXISTS status_events (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  actor TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  body TEXT NOT NULL,
  to_phone TEXT,
  from_phone TEXT,
  template_key TEXT,
  status TEXT NOT NULL,
  delivery TEXT,
  twilio_sid TEXT,
  error TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT 'Staff',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS calls (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS watch_profiles (
  item_id TEXT PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
  is_watch INTEGER NOT NULL DEFAULT 0,
  brand TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  reference_no TEXT NOT NULL DEFAULT '',
  serial_no TEXT NOT NULL DEFAULT '',
  case_size TEXT NOT NULL DEFAULT '',
  case_material TEXT NOT NULL DEFAULT '',
  dial TEXT NOT NULL DEFAULT '',
  movement_type TEXT NOT NULL DEFAULT '',
  caliber TEXT NOT NULL DEFAULT '',
  confidence TEXT NOT NULL DEFAULT '',
  confidence_note TEXT NOT NULL DEFAULT '',
  needs_caseback INTEGER NOT NULL DEFAULT 0,
  needs_dial INTEGER NOT NULL DEFAULT 0,
  visible_text TEXT NOT NULL DEFAULT '[]',
  suggested_parts TEXT NOT NULL DEFAULT '[]',
  confirmed INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS parts_catalog (
  id TEXT PRIMARY KEY,
  brand TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT '',
  reference_no TEXT NOT NULL DEFAULT '',
  caliber TEXT NOT NULL DEFAULT '',
  part_name TEXT NOT NULL,
  part_number TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ticket_parts (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  part_name TEXT NOT NULL,
  part_number TEXT NOT NULL DEFAULT '',
  qty REAL NOT NULL DEFAULT 1,
  unit_cost_cents INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS templates (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  body TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS lookup_hits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_phone ON items(customer_phone);
CREATE INDEX IF NOT EXISTS idx_items_created ON items(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_item ON messages(item_id);
CREATE INDEX IF NOT EXISTS idx_messages_sid ON messages(twilio_sid);
CREATE INDEX IF NOT EXISTS idx_catalog_brand ON parts_catalog(brand);
`

function migrateItems(db: Database.Database) {
  const names = new Set((db.prepare("PRAGMA table_info(items)").all() as { name: string }[]).map((column) => column.name))
  const columns: [string, string][] = [
    ["first_name", "TEXT NOT NULL DEFAULT ''"],
    ["last_name", "TEXT NOT NULL DEFAULT ''"],
    ["alt_phone", "TEXT NOT NULL DEFAULT ''"],
    ["email", "TEXT NOT NULL DEFAULT ''"],
    ["street", "TEXT NOT NULL DEFAULT ''"],
    ["apt", "TEXT NOT NULL DEFAULT ''"],
    ["city", "TEXT NOT NULL DEFAULT ''"],
    ["state", "TEXT NOT NULL DEFAULT ''"],
    ["zip", "TEXT NOT NULL DEFAULT ''"],
    ["preferred_contact", "TEXT NOT NULL DEFAULT 'text'"],
    ["preferred_language", "TEXT NOT NULL DEFAULT 'English'"],
    ["email_consent", "INTEGER NOT NULL DEFAULT 0"],
    ["heard_about", "TEXT NOT NULL DEFAULT ''"],
    ["customer_notes", "TEXT NOT NULL DEFAULT ''"],
  ]
  for (const [name, definition] of columns) {
    if (!names.has(name)) db.exec(`ALTER TABLE items ADD COLUMN ${name} ${definition}`)
  }
  db.exec("CREATE INDEX IF NOT EXISTS idx_items_email ON items(email)")
  const pending = db.prepare("SELECT id, customer_name FROM items WHERE first_name = '' AND customer_name != ''").all() as { id: string; customer_name: string }[]
  const fill = db.prepare("UPDATE items SET first_name = ?, last_name = ? WHERE id = ?")
  for (const row of pending) {
    const [first, ...rest] = row.customer_name.split(" ")
    fill.run(first, rest.join(" "), row.id)
  }
  const addresses = db.prepare("SELECT id, customer_address FROM items WHERE street = '' AND customer_address != ''").all() as { id: string; customer_address: string }[]
  const address = db.prepare("UPDATE items SET street = ?, city = ?, state = ?, zip = ? WHERE id = ?")
  for (const row of addresses) {
    const bits = row.customer_address.split(",").map((part) => part.trim())
    const stateZip = (bits[2] || "").split(/\s+/).filter(Boolean)
    address.run(bits[0] || "", bits[1] || "", stateZip[0] || "", stateZip[1] || "", row.id)
  }
}
