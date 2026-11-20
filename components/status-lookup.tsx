"use client"

import { useState } from "react"
import { CustomerFrame } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatDay } from "@/lib/format"

type Result = {
  ticketNumber: string
  statusLabel: string
  description: string
  estimateReadyOn: string | null
  quote: string | null
  balance: string | null
  shop: { hoursShort: string; phoneDisplay: string; address: string }
}

export function StatusLookup({ initialTicket = "" }: { initialTicket?: string }) {
  const [ticket, setTicket] = useState(initialTicket)
  const [phoneLast4, setPhoneLast4] = useState("")
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState("")

  return (
    <CustomerFrame>
      <h1 className="serif text-4xl">Repair status</h1>
      <p className="mt-2 text-sm text-muted">Enter the ticket number and the last 4 digits of the phone number on the claim slip.</p>
      <form
        className="mt-6 space-y-3"
        onSubmit={async (event) => {
          event.preventDefault()
          setError("")
          setResult(null)
          const response = await fetch("/api/status/lookup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ticket, phoneLast4 }),
          })
          const data = await response.json()
          if (!response.ok) setError(data.error || "Lookup failed")
          else setResult(data.status)
        }}
      >
        <label>
          <Label>Ticket number</Label>
          <Input value={ticket} onChange={(event) => setTicket(event.target.value)} autoComplete="off" />
        </label>
        <label>
          <Label>Last 4 of phone</Label>
          <Input value={phoneLast4} onChange={(event) => setPhoneLast4(event.target.value)} inputMode="numeric" maxLength={4} />
        </label>
        <Button type="submit">Look up</Button>
      </form>
      {error && <p className="mt-4 text-sm text-danger">{error}</p>}
      {result && (
        <div className="mt-8 border border-line bg-white p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-muted">{result.ticketNumber}</p>
          <h2 className="serif mt-2 text-3xl">{result.statusLabel}</h2>
          <p className="mt-3">{result.description}</p>
          <p className="mt-3">Estimate ready {formatDay(result.estimateReadyOn)}</p>
          <p>Quote {result.quote || "—"} · Balance {result.balance || "—"}</p>
          <p className="mt-4 text-sm text-muted">{result.shop.address}<br />{result.shop.phoneDisplay}<br />{result.shop.hoursShort}</p>
        </div>
      )}
    </CustomerFrame>
  )
}
