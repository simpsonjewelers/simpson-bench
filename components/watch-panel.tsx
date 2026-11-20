"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatMoney } from "@/lib/format"
import { genericUnverifiedParts } from "@/lib/catalog"
import type { ShopItem, TicketPart } from "@/lib/types"

export function WatchPanel({ item, onChange }: { item: ShopItem; onChange: (item: ShopItem) => void }) {
  const watch = item.watch
  const [form, setForm] = useState({
    isWatch: Boolean(watch?.isWatch),
    brand: watch?.brand ?? "",
    model: watch?.model ?? "",
    referenceNo: watch?.referenceNo ?? "",
    serialNo: watch?.serialNo ?? "",
    caseSize: watch?.caseSize ?? "",
    caseMaterial: watch?.caseMaterial ?? "",
    dial: watch?.dial ?? "",
    movementType: watch?.movementType || "unknown",
    caliber: watch?.caliber ?? "",
  })
  const [error, setError] = useState("")
  const [partCost, setPartCost] = useState<Record<string, string>>({})
  const [partQty, setPartQty] = useState<Record<string, string>>({})
  const [manual, setManual] = useState({ partName: "", partNumber: "", qty: "1", cost: "" })

  const catalog = item.catalogParts
  const unverified = item.partsSource === "unverified"
    ? item.watch?.suggestedParts?.length
      ? item.watch.suggestedParts
      : genericUnverifiedParts(form.movementType)
    : []

  async function save(confirmed: boolean) {
    setError("")
    const response = await fetch(`/api/items/${item.id}/watch`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, confirmed }),
    })
    const data = await response.json()
    if (!response.ok) return setError(data.error || "Could not save the watch.")
    onChange(data.item)
  }

  async function addPart(
    part: { name: string; partNumber: string; qty?: string; cost?: string },
    source: TicketPart["source"],
    key: string,
  ) {
    setError("")
    const response = await fetch(`/api/items/${item.id}/parts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        partName: part.name,
        partNumber: part.partNumber,
        qty: Number(part.qty || partQty[key] || 1),
        cost: part.cost ?? partCost[key] ?? "0",
        source,
      }),
    })
    const data = await response.json()
    if (!response.ok) return setError(data.error || "Could not add the part.")
    onChange(data.item)
  }

  async function saveToCatalog(part: { name: string; partNumber: string }) {
    setError("")
    const response = await fetch("/api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brand: form.brand,
        model: form.model,
        referenceNo: form.referenceNo,
        caliber: form.caliber,
        partName: part.name,
        partNumber: part.partNumber,
        notes: "Saved from an unverified suggestion.",
      }),
    })
    const data = await response.json()
    if (!response.ok) return setError(data.error || "Could not save to the catalog.")
    const fresh = await fetch(`/api/items/${item.id}`).then((result) => result.json())
    onChange(fresh.item)
  }

  async function removePart(partId: string) {
    const response = await fetch(`/api/items/${item.id}/parts?partId=${partId}`, { method: "DELETE" })
    const data = await response.json()
    if (response.ok) onChange(data.item)
  }

  const partsTotal = item.ticketParts.reduce((sum, part) => sum + part.qty * part.unitCostCents, 0)

  return (
    <section className="border border-line bg-white p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="serif text-3xl">Watch</h2>
          <p className="mt-1 text-sm text-muted">Brand, model, reference, and caliber. Serial number is typed by staff, not filled in by the photo reading.</p>
        </div>
        {watch?.confidence && (
          <p className="text-xs uppercase tracking-[0.16em]">Reading confidence: {watch.confidence}</p>
        )}
      </div>
      {watch?.confidenceNote && <p className="mt-2 text-sm text-muted">{watch.confidenceNote}</p>}
      {(watch?.needsDial || watch?.needsCaseback) && form.isWatch && (
        <p className="mt-3 border border-ink px-3 py-2 text-sm">
          Film the {watch.needsDial ? "dial" : ""}{watch.needsDial && watch.needsCaseback ? " and " : ""}{watch.needsCaseback ? "caseback" : ""} clearly, then run the photo reading again.
        </p>
      )}
      <label className="mt-4 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.isWatch} onChange={(event) => setForm({ ...form, isWatch: event.target.checked })} />
        This is a watch
      </label>
      {form.isWatch && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Brand" value={form.brand} onChange={(brand) => setForm({ ...form, brand })} />
          <Field label="Model / collection" value={form.model} onChange={(model) => setForm({ ...form, model })} />
          <Field label="Reference no." value={form.referenceNo} onChange={(referenceNo) => setForm({ ...form, referenceNo })} />
          <Field label="Serial no. (manual)" value={form.serialNo} onChange={(serialNo) => setForm({ ...form, serialNo })} />
          <Field label="Case size" value={form.caseSize} onChange={(caseSize) => setForm({ ...form, caseSize })} />
          <Field label="Case material" value={form.caseMaterial} onChange={(caseMaterial) => setForm({ ...form, caseMaterial })} />
          <Field label="Dial" value={form.dial} onChange={(dial) => setForm({ ...form, dial })} />
          <Field label="Caliber / movement" value={form.caliber} onChange={(caliber) => setForm({ ...form, caliber })} />
          <label className="block text-sm">
            <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-muted">Movement type</span>
            <select className="h-12 w-full border border-line bg-white px-3" value={form.movementType} onChange={(event) => setForm({ ...form, movementType: event.target.value })}>
              <option value="unknown">Unknown</option>
              <option value="automatic">Automatic</option>
              <option value="manual">Manual</option>
              <option value="quartz">Quartz</option>
            </select>
          </label>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => save(false)}>Save watch details</Button>
        {form.isWatch && <Button type="button" onClick={() => save(true)}>Confirm details</Button>}
        {watch?.confirmed && <p className="self-center text-sm">Confirmed by staff.</p>}
      </div>
      {!!watch?.visibleText?.length && (
        <p className="mt-3 text-sm text-muted">Text read in the photos: {watch.visibleText.join(" · ")}</p>
      )}

      {form.isWatch && (
        <div className="mt-8">
          <h3 className="serif text-2xl">Parts reference</h3>
          <p className="mt-1 text-sm text-muted">
            Manufacturer part numbers for this brand and model. Simpson Jewelers orders parts direct from the brand. This list is a reference, not an order.
          </p>
          {catalog.length > 0 ? (
            <PartTable
              rows={catalog.map((part) => ({ key: part.id, name: part.partName, partNumber: part.partNumber, note: part.notes }))}
              partQty={partQty}
              partCost={partCost}
              setPartQty={setPartQty}
              setPartCost={setPartCost}
              onAdd={(row) => addPart(row, "catalog", row.key)}
            />
          ) : (
            <div className="mt-3">
              <p className="border border-danger px-3 py-2 text-sm text-danger">
                Unverified. The shop catalog has no parts list for this model. These names came from the photo reading or a generic movement list and may be wrong. Confirm the manufacturer part number with the brand, then save it to the catalog.
              </p>
              <PartTable
                rows={unverified.map((part, index) => ({ key: `u-${index}`, name: part.name, partNumber: part.partNumber, note: part.reason }))}
                partQty={partQty}
                partCost={partCost}
                setPartQty={setPartQty}
                setPartCost={setPartCost}
                onAdd={(row) => addPart({ name: row.name, partNumber: row.partNumber }, "unverified", row.key)}
                onSave={saveToCatalog}
              />
            </div>
          )}
          {catalog.length > 0 && <p className="mt-2 text-sm text-muted">A shop list is on file, so unverified suggestions are hidden.</p>}

          <h3 className="serif mt-8 text-2xl">On this repair ticket</h3>
          <ul className="mt-3 divide-y divide-line border border-line">
            {item.ticketParts.map((part) => (
              <li key={part.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>{part.partName} · {part.partNumber || "no number"} · qty {part.qty}</span>
                <span>{formatMoney(part.qty * part.unitCostCents)}</span>
                <button type="button" className="underline" onClick={() => removePart(part.id)}>Remove</button>
              </li>
            ))}
            {item.ticketParts.length === 0 && <li className="px-3 py-3 text-sm text-muted">No parts on this ticket yet.</li>}
          </ul>
          <p className="mt-2 text-sm">Parts cost {formatMoney(partsTotal)}. This is shop cost on the job ticket, separate from the customer quote.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <Input placeholder="Part name" value={manual.partName} onChange={(event) => setManual({ ...manual, partName: event.target.value })} aria-label="Part name" />
            <Input placeholder="Part number" value={manual.partNumber} onChange={(event) => setManual({ ...manual, partNumber: event.target.value })} aria-label="Part number" />
            <Input placeholder="Qty" value={manual.qty} onChange={(event) => setManual({ ...manual, qty: event.target.value })} aria-label="Quantity" />
            <Input placeholder="Cost" value={manual.cost} onChange={(event) => setManual({ ...manual, cost: event.target.value })} aria-label="Cost" />
          </div>
          <Button
            type="button"
            variant="outline"
            className="mt-2"
            onClick={() => addPart({ name: manual.partName, partNumber: manual.partNumber, qty: manual.qty, cost: manual.cost || "0" }, "manual", "manual")}
          >
            Add part to ticket
          </Button>
        </div>
      )}
      {error && <p className="mt-3 text-danger">{error}</p>}
    </section>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function PartTable({
  rows,
  partQty,
  partCost,
  setPartQty,
  setPartCost,
  onAdd,
  onSave,
}: {
  rows: { key: string; name: string; partNumber: string; note: string }[]
  partQty: Record<string, string>
  partCost: Record<string, string>
  setPartQty: (value: Record<string, string>) => void
  setPartCost: (value: Record<string, string>) => void
  onAdd: (row: { key: string; name: string; partNumber: string }) => void
  onSave?: (part: { name: string; partNumber: string }) => void
}) {
  if (!rows.length) return <p className="mt-3 text-sm text-muted">No part names yet.</p>
  return (
    <ul className="mt-3 divide-y divide-line border border-line">
      {rows.map((row) => (
        <li key={row.key} className="grid gap-2 px-3 py-3 sm:grid-cols-[1fr_auto]">
          <div>
            <p className="font-medium">{row.name}</p>
            <p className="text-sm">{row.partNumber || "No manufacturer number yet"}</p>
            {row.note && <p className="text-sm text-muted">{row.note}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input className="h-10 w-16" value={partQty[row.key] ?? "1"} onChange={(event) => setPartQty({ ...partQty, [row.key]: event.target.value })} aria-label={`Quantity for ${row.name}`} />
            <Input className="h-10 w-24" placeholder="Cost" value={partCost[row.key] ?? ""} onChange={(event) => setPartCost({ ...partCost, [row.key]: event.target.value })} aria-label={`Cost for ${row.name}`} />
            <Button type="button" size="sm" onClick={() => onAdd(row)}>Add to ticket</Button>
            {onSave && row.partNumber && (
              <Button type="button" size="sm" variant="outline" onClick={() => onSave(row)}>Save to catalog</Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
