"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Shell } from "@/components/shell"
import { Dialog } from "@/components/dialog"
import { Button } from "@/components/ui/button"
import { formatDay, formatMoney, formatPhone, formatWhen } from "@/lib/format"
import { lienStageLabel } from "@/lib/policy"
import { statusLabel } from "@/lib/statuses"
import type { ReportRow } from "@/lib/types"

const titles: Record<string, string> = {
  "in-progress": "In progress",
  awaiting: "Awaiting approval",
  pickup: "Not picked up",
  risk: "Abandoned / at risk",
  queue: "Courtesy text queue",
}

export function ReportView({ kind }: { kind: string }) {
  const [days, setDays] = useState(30)
  const [rows, setRows] = useState<ReportRow[] | null>(null)
  const [status, setStatus] = useState("all")
  const [sort, setSort] = useState("days")
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    const query = kind === "pickup" ? `&days=${days}` : ""
    fetch(`/api/reports?kind=${kind}${query}`)
      .then((response) => response.json())
      .then((data) => setRows(data.rows ?? []))
      .catch(() => setError("The report could not be loaded."))
  }, [kind, days, notice])

  const shown = useMemo(() => {
    const list = (rows ?? []).filter((row) => status === "all" || row.status === status)
    const value = (row: ReportRow) => {
      if (sort === "ticket") return row.ticketNumber
      if (sort === "customer") return row.customerName
      if (sort === "status") return row.status
      if (sort === "price") return row.repairPriceCents ?? -1
      if (sort === "ready") return row.estimateReadyOn ?? ""
      if (sort === "waiting") return row.daysWaiting ?? row.daysSinceReady ?? 0
      return row.daysInShop
    }
    return [...list].sort((a, b) => (value(a) > value(b) ? -1 : 1))
  }, [rows, status, sort])

  const longest = kind === "awaiting" ? Math.max(0, ...shown.map((row) => row.daysWaiting ?? 0)) : 0

  function csv() {
    const header = ["ticket", "customer", "phone", "status", "description", "days in shop", "quote", "balance", "ready date", "days waiting", "follow-ups", "reminders", "last contact"]
    const lines = shown.map((row) => [
      row.ticketNumber,
      row.customerName,
      row.customerPhone,
      statusLabel(row.status),
      row.description,
      row.daysInShop,
      row.repairPriceCents ?? "",
      row.balanceCents ?? "",
      row.estimateReadyOn ?? "",
      row.daysWaiting ?? "",
      row.followups,
      row.reminders,
      row.lastContactAt ?? "",
    ])
    const file = [header, ...lines].map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([file], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${kind}.csv`
    link.click()
  }

  async function bulk(sendKind: "reminder_approval" | "reminder_pickup") {
    const response = await fetch("/api/messages/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selected, kind: sendKind, milestone: sendKind === "reminder_pickup" ? days : null }),
    })
    const data = await response.json()
    if (!response.ok) return setError(data.error || "Texts were not sent")
    const failed = (data.results as { ok: boolean }[]).filter((result) => !result.ok).length
    setNotice(data.testMode ? `Logged as not sent (test mode). ${failed} not prepared.` : `Texts sent. ${failed} failed.`)
    setConfirm(false)
    setSelected([])
  }

  return (
    <Shell>
      <div className="no-print mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Report</p>
          <h1 className="serif text-4xl">{titles[kind] || "Report"}</h1>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => window.print()}>Print</Button>
          <Button type="button" variant="outline" onClick={csv}>Export CSV</Button>
        </div>
      </div>
      <p className="serif text-5xl">{shown.length}</p>
      <p className="text-sm text-muted">{kind === "in-progress" ? "Received, inspecting, awaiting approval, and in repair. Ready, picked up, and declined are excluded." : kind === "queue" ? "Courtesy reminders only. A text is not legal notice under NY Lien Law §186." : " "} </p>
      {kind === "pickup" && (
        <label className="no-print mt-3 block text-sm">
          Days since marked ready
          <input className="ml-2 h-10 w-20 border border-line px-2" type="number" min={1} value={days} onChange={(event) => setDays(Number(event.target.value) || 30)} />
        </label>
      )}
      <div className="no-print mt-3 flex flex-wrap gap-2">
        <select className="h-10 border border-line bg-white px-2" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status">
          <option value="all">All statuses</option>
          <option value="received">Received</option>
          <option value="inspecting">Inspecting</option>
          <option value="awaiting_approval">Awaiting approval</option>
          <option value="in_repair">In repair</option>
          <option value="ready">Ready</option>
        </select>
        <select className="h-10 border border-line bg-white px-2" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort">
          <option value="days">Days in shop</option>
          <option value="waiting">Days waiting</option>
          <option value="ticket">Ticket</option>
          <option value="customer">Customer</option>
          <option value="status">Status</option>
          <option value="price">Quote</option>
          <option value="ready">Ready date</option>
        </select>
        {selected.length > 0 && (kind === "awaiting" || kind === "pickup" || kind === "queue") && (
          <Button type="button" onClick={() => setConfirm(true)}>Send {selected.length} reminders</Button>
        )}
      </div>
      {error && <p className="mt-3 text-danger">{error}</p>}
      {notice && <p className="mt-3">{notice}</p>}
      <div className="mt-4 overflow-x-auto border border-line bg-white">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-[0.12em] text-muted">
            <tr>
              <th className="p-2" />
              <th className="p-2">Ticket</th>
              <th className="p-2">Piece</th>
              <th className="p-2">Customer</th>
              <th className="p-2">Status</th>
              <th className="p-2">Days</th>
              <th className="p-2">Quote</th>
              <th className="p-2">{kind === "pickup" || kind === "risk" ? "Balance / ready" : "Ready date"}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => {
              const waiting = row.daysWaiting ?? row.daysSinceReady ?? 0
              const highlight = kind === "awaiting" && waiting === longest && longest > 0
              return (
                <tr key={row.id} className={`border-b border-line ${row.overdue ? "text-danger" : ""} ${highlight ? "bg-paper" : ""}`}>
                  <td className="p-2">
                    <input type="checkbox" checked={selected.includes(row.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, row.id] : selected.filter((id) => id !== row.id))} aria-label={`Select ${row.ticketNumber}`} />
                  </td>
                  <td className="p-2">
                    {row.thumbUrl && <img src={row.thumbUrl} alt="" className="mb-1 h-12 w-12 object-cover" />}
                    <Link href={`/items/${row.id}`} className="underline">{row.ticketNumber}</Link>
                    {highlight && <div className="text-xs uppercase tracking-[0.12em]">Longest wait</div>}
                  </td>
                  <td className="max-w-xs p-2">{row.description || row.requestedRepair || "—"}</td>
                  <td className="p-2">
                    {row.customerName || "—"}
                    <div>{row.customerPhone ? formatPhone(row.customerPhone) : ""}</div>
                    {row.customerPhone && <a className="underline" href={`tel:${row.customerPhone}`}>Call</a>}
                  </td>
                  <td className="p-2">{statusLabel(row.status)}{row.lienStage !== "none" ? ` · ${lienStageLabel(row.lienStage)}` : ""}</td>
                  <td className={`p-2 ${row.overdue || (kind !== "in-progress" && waiting >= 30) ? "text-danger" : ""}`}>
                    {kind === "awaiting" ? `${row.daysWaiting ?? 0} waiting` : kind === "pickup" || kind === "risk" || kind === "queue" ? `${row.daysSinceReady ?? 0} since ready` : `${row.daysInShop} in shop`}
                    <div className="text-xs">{kind === "awaiting" ? `${row.followups} follow-ups` : `${row.reminders} reminders`}</div>
                    <div className="text-xs">Last contact {formatWhen(row.lastContactAt)}</div>
                  </td>
                  <td className="p-2">{formatMoney(row.repairPriceCents)}</td>
                  <td className="p-2">
                    {kind === "pickup" || kind === "risk" ? formatMoney(row.balanceCents) : formatDay(row.estimateReadyOn)}
                    <div className="text-xs">{row.estimateReadyOn && kind !== "in-progress" ? `Ready date ${formatDay(row.estimateReadyOn)}` : row.readyAt ? `Marked ready ${formatDay(row.readyAt)}` : ""}</div>
                    {row.overdue && <div>Past estimated date</div>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Dialog open={confirm} title="Send reminder texts" onClose={() => setConfirm(false)}>
        <p className="text-sm">Each selected customer gets their own text with their ticket number. Twilio test mode logs the message as not sent when no credentials are set.</p>
        <Button className="mt-4" type="button" onClick={() => bulk(kind === "pickup" || kind === "queue" ? "reminder_pickup" : "reminder_approval")}>
          Confirm and send {selected.length}
        </Button>
      </Dialog>
    </Shell>
  )
}
