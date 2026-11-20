"use client"

import type * as React from "react"
import { useEffect, useState } from "react"
import { Shell } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CATALOG_CSV_HEADER } from "@/lib/catalog"
import type { CatalogPart } from "@/lib/types"

const empty = { brand: "", model: "", referenceNo: "", caliber: "", partName: "", partNumber: "", notes: "" }

export function CatalogClient() {
  const [query, setQuery] = useState("")
  const [parts, setParts] = useState<CatalogPart[]>([])
  const [form, setForm] = useState(empty)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  async function load(q = query) {
    const response = await fetch(`/api/catalog?q=${encodeURIComponent(q)}`)
    const data = await response.json()
    setParts(data.parts ?? [])
  }

  useEffect(() => {
    load().catch(() => setError("The catalog could not be loaded."))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function save(event: React.FormEvent) {
    event.preventDefault()
    const response = await fetch("/api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    const data = await response.json()
    if (!response.ok) return setError(data.error || "Could not save")
    setForm(empty)
    setNotice("Part saved to the shop catalog.")
    load()
  }

  return (
    <Shell>
      <p className="text-xs uppercase tracking-[0.18em] text-muted">Parts catalog</p>
      <h1 className="serif text-4xl">Manufacturer part numbers</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Keep the brand’s own parts list here, one row per manufacturer part number. Staff order parts direct from the brand. This page does not search suppliers or place orders.
      </p>
      <form onSubmit={save} className="mt-6 grid gap-2 border border-line bg-white p-4 sm:grid-cols-2">
        {(["brand", "model", "referenceNo", "caliber", "partName", "partNumber", "notes"] as const).map((key) => (
          <Input key={key} placeholder={key} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} aria-label={key} required={key === "brand" || key === "partName" || key === "partNumber"} />
        ))}
        <Button type="submit">Add part number</Button>
      </form>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Input className="max-w-xs" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter brand, reference, caliber" aria-label="Filter catalog" />
        <Button type="button" variant="outline" onClick={() => load(query)}>Search</Button>
        <label className="inline-flex h-12 cursor-pointer items-center border border-line bg-white px-4 text-sm">
          Import CSV
          <input
            className="sr-only"
            type="file"
            accept=".csv,text/csv"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              if (!file) return
              const formData = new FormData()
              formData.set("file", file)
              const response = await fetch("/api/catalog", { method: "POST", body: formData })
              const data = await response.json()
              if (!response.ok) setError(data.error || "Import failed")
              else {
                setNotice(`Imported ${data.imported}. Skipped ${data.skipped} duplicates.`)
                load()
              }
            }}
          />
        </label>
        <button
          type="button"
          className="text-sm underline"
          onClick={() => {
            const blob = new Blob([`${CATALOG_CSV_HEADER}\n`], { type: "text/csv" })
            const url = URL.createObjectURL(blob)
            const link = document.createElement("a")
            link.href = url
            link.download = "parts-catalog.csv"
            link.click()
          }}
        >
          Download CSV template
        </button>
      </div>
      {error && <p className="mt-3 text-danger">{error}</p>}
      {notice && <p className="mt-3">{notice}</p>}
      <ul className="mt-4 divide-y divide-line border border-line bg-white">
        {parts.map((part) => (
          <li key={part.id} className="grid gap-1 px-3 py-3 text-sm sm:grid-cols-[1fr_auto]">
            <div>
              <p className="font-medium">{part.brand} {part.referenceNo || part.model} {part.caliber && `· ${part.caliber}`}</p>
              <p>{part.partName} · {part.partNumber}</p>
              {part.notes && <p className="text-muted">{part.notes}</p>}
            </div>
            <button
              type="button"
              className="text-left underline"
              onClick={async () => {
                await fetch(`/api/catalog?id=${part.id}`, { method: "DELETE" })
                load()
              }}
            >
              Delete
            </button>
          </li>
        ))}
        {parts.length === 0 && <li className="px-3 py-4 text-sm text-muted">No part numbers yet. Add a row or import a brand CSV.</li>}
      </ul>
    </Shell>
  )
}
