"use client"

import { useEffect, useState } from "react"
import { CustomerFrame } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { formatDay } from "@/lib/format"

export function ApproveClient({ token }: { token: string }) {
  const [info, setInfo] = useState<{
    ticketNumber: string
    requestedRepair: string
    description: string
    damageNotes: string
    photos: { id: string; url: string }[]
    quote: string | null
    ready: string | null
    already: boolean
    status: string
  } | null>(null)
  const [done, setDone] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    fetch(`/api/approve?token=${token}`)
      .then((response) => response.json())
      .then((data) => {
        if (data.error) setError(data.error)
        else setInfo(data)
      })
  }, [token])

  async function choose(decision: "yes" | "no") {
    const response = await fetch("/api/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, decision }),
    })
    const data = await response.json()
    if (!response.ok) setError(data.error || "Could not save your choice")
    else setDone(decision === "yes" ? "Approved. We will text you when it is ready." : "Declined. Please call the shop about pickup.")
  }

  return (
    <CustomerFrame>
      <h1 className="serif text-4xl">Approve the repair</h1>
      {error && <p className="mt-4 text-danger">{error}</p>}
      {info && (
        <div className="mt-6 border border-line bg-white p-5">
          <p className="text-xs uppercase tracking-[0.16em]">{info.ticketNumber}</p>
          {info.photos.length > 0 && (
            <div className="mt-4 flex gap-2">
              {info.photos.map((photo) => (
                <img key={photo.id} src={photo.url} alt="" className="h-24 w-20 border border-line object-cover" />
              ))}
            </div>
          )}
          <p className="mt-4 text-lg">{info.description}</p>
          <p className="mt-2 text-sm text-muted">{info.damageNotes}</p>
          <p className="mt-3">{info.requestedRepair}</p>
          <p className="mt-3">Estimate {info.quote || "—"}</p>
          <p>Ready about {formatDay(info.ready)}</p>
          {done && <p className="mt-4">{done}</p>}
          {!done && info.already && <p className="mt-4">This repair is already {info.status.replaceAll("_", " ")}.</p>}
          {!done && !info.already && (
            <div className="mt-5 flex gap-2">
              <Button type="button" onClick={() => choose("yes")}>Approve</Button>
              <Button type="button" variant="outline" onClick={() => choose("no")}>Decline</Button>
            </div>
          )}
        </div>
      )}
    </CustomerFrame>
  )
}
