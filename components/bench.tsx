"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Shell } from "@/components/shell"
import { Input } from "@/components/ui/input"
import { formatMoney, formatPhone, formatWhen } from "@/lib/format"
import { statusLabel } from "@/lib/statuses"
import type { ItemSummary } from "@/lib/types"

export function Bench() {
  const [query, setQuery] = useState("")
  const [items, setItems] = useState<ItemSummary[] | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    const handle = setTimeout(() => {
      fetch(`/api/items?q=${encodeURIComponent(query)}`)
        .then((response) => response.json())
        .then((data) => setItems(data.items ?? []))
        .catch(() => setError("The bench could not be loaded."))
    }, 150)
    return () => clearTimeout(handle)
  }, [query])

  return (
    <Shell>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Repair bench</p>
          <h1 className="serif text-4xl">Pieces in the shop</h1>
        </div>
        <p className="text-sm text-muted">{items ? `${items.length} open records` : ""}</p>
      </div>
      <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ticket, name, phone, repair" aria-label="Search tickets" />
      {error && <p className="mt-4 text-danger">{error}</p>}
      {!items && !error && <p className="mt-8 text-muted">Loading the bench…</p>}
      {items && items.length === 0 && (
        <div className="mt-10 border border-line bg-white p-8">
          <h2 className="serif text-3xl">No pieces yet</h2>
          <p className="mt-2 max-w-md text-muted">Record a short turn of the jewelry. The intake opens a ticket as soon as the stills are saved.</p>
          <Link href="/intake" className="mt-6 inline-block border border-ink bg-ink px-5 py-3 text-sm uppercase tracking-[0.14em] text-white">
            New intake
          </Link>
        </div>
      )}
      <ul className="mt-6 space-y-3">
        {items?.map((item) => (
          <li key={item.id}>
            <Link href={`/items/${item.id}`} className="flex gap-3 border border-line bg-white p-3">
              <div className="h-20 w-20 shrink-0 bg-paper">
                {item.thumbUrl && <img src={item.thumbUrl} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="serif whitespace-nowrap text-lg tracking-tight">{item.ticketNumber}</p>
                <p className="text-[11px] uppercase tracking-[0.12em] text-muted">{statusLabel(item.status)}</p>
                <p className="truncate">{item.customerName || "Customer not added"}{item.customerPhone ? ` · ${formatPhone(item.customerPhone)}` : ""}</p>
                <p className="truncate text-sm text-muted">{item.description || item.requestedRepair || "No description yet"}</p>
                <p className={`mt-1 text-xs ${item.overdue ? "text-danger" : "text-muted"}`}>
                  {formatWhen(item.createdAt)}
                  {item.overdue ? " · Past the estimated date" : ""}
                  {item.repairPriceCents != null ? ` · ${formatMoney(item.repairPriceCents)}` : ""}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Shell>
  )
}
