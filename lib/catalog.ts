export type CatalogDraft = {
  brand: string
  model: string
  referenceNo: string
  caliber: string
  partName: string
  partNumber: string
  notes: string
}

export type SuggestedPart = {
  name: string
  partNumber: string
  reason: string
}

export function normKey(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

export function catalogMatchesWatch(
  entry: { brand: string; model: string; referenceNo: string; caliber: string },
  watch: { brand: string; model: string; referenceNo: string; caliber: string },
): boolean {
  if (!normKey(watch.brand) || normKey(entry.brand) !== normKey(watch.brand)) return false
  const watchId = normKey(watch.referenceNo) || normKey(watch.model)
  const entryId = normKey(entry.referenceNo) || normKey(entry.model)
  if (watchId && entryId && watchId === entryId) return true
  const sameCaliber = normKey(watch.caliber) && normKey(entry.caliber) === normKey(watch.caliber)
  if (sameCaliber && (!entryId || entryId === watchId)) return true
  return false
}

export function genericUnverifiedParts(movementType: string): SuggestedPart[] {
  const quartz = movementType === "quartz"
  const parts: SuggestedPart[] = [
    { name: "Crystal", partNumber: "", reason: "Common service part. Take the number from the brand list." },
    { name: "Crown", partNumber: "", reason: "Common service part. Take the number from the brand list." },
    { name: "Stem", partNumber: "", reason: "Common service part. Take the number from the brand list." },
    { name: "Case gasket", partNumber: "", reason: "Common service part. Take the number from the brand list." },
  ]
  if (quartz) {
    parts.unshift({
      name: "Battery",
      partNumber: "",
      reason: "Cell size depends on the caliber. Do not guess a number.",
    })
  } else if (movementType === "automatic" || movementType === "manual") {
    parts.push({
      name: "Mainspring",
      partNumber: "",
      reason: "Match the caliber on the brand parts list.",
    })
  }
  return parts
}

export function parseCatalogCsv(text: string): CatalogDraft[] {
  const rows = parseCsv(text.replace(/^\uFEFF/, ""))
  if (!rows.length) return []
  const header = rows[0].map((cell) => cell.trim().toLowerCase().replace(/[\s-]+/g, "_"))
  const column = (...names: string[]) => header.findIndex((cell) => names.includes(cell))
  const brand = column("brand")
  const model = column("model", "collection")
  const referenceNo = column("reference", "reference_no", "reference_number", "ref")
  const caliber = column("caliber", "calibre", "movement")
  const partName = column("part_name", "name", "part")
  const partNumber = column("part_number", "number", "mfr_part_number", "manufacturer_part_number")
  const notes = column("notes", "note")
  if (brand < 0 || partName < 0 || partNumber < 0) {
    throw new Error("CSV needs columns for brand, part_name, and part_number.")
  }
  const drafts: CatalogDraft[] = []
  for (const row of rows.slice(1)) {
    if (row.every((cell) => !cell.trim())) continue
    const draft: CatalogDraft = {
      brand: (row[brand] ?? "").trim(),
      model: model >= 0 ? (row[model] ?? "").trim() : "",
      referenceNo: referenceNo >= 0 ? (row[referenceNo] ?? "").trim() : "",
      caliber: caliber >= 0 ? (row[caliber] ?? "").trim() : "",
      partName: (row[partName] ?? "").trim(),
      partNumber: (row[partNumber] ?? "").trim(),
      notes: notes >= 0 ? (row[notes] ?? "").trim() : "",
    }
    if (!draft.brand || !draft.partName || !draft.partNumber) continue
    drafts.push(draft)
  }
  return drafts
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        cell += char
      }
      continue
    }
    if (char === '"') {
      quoted = true
    } else if (char === ",") {
      row.push(cell)
      cell = ""
    } else if (char === "\n") {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
    } else if (char !== "\r") {
      cell += char
    }
  }
  if (cell.length || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

export const CATALOG_CSV_HEADER = "brand,model,reference,caliber,part_name,part_number,notes"
