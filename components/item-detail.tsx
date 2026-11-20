"use client"

import type * as React from "react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Dialog } from "@/components/dialog"
import { Shell } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CustomerFields, type CustomerDraft } from "@/components/customer-fields"
import { WatchPanel } from "@/components/watch-panel"
import { dollarsToInput, formatMoney, formatPhone, formatWhen } from "@/lib/format"
import { LIEN_NOTE, lienStageLabel } from "@/lib/policy"
import { STATUSES, statusLabel } from "@/lib/statuses"
import type { ShopItem } from "@/lib/types"

export function ItemDetail({ id }: { id: string }) {
  const params = useSearchParams()
  const [item, setItem] = useState<ShopItem | null>(null)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormState | null>(null)
  const [preview, setPreview] = useState<{ title: string; body: string; to: string; testMode: boolean; warnings: string[]; notes: string[]; kind: string; price?: string; readyDate?: string; milestone?: number | null } | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const [note, setNote] = useState("")
  const [author, setAuthor] = useState("")
  const [callOutcome, setCallOutcome] = useState("spoke")
  const [callNote, setCallNote] = useState("")

  async function load() {
    const response = await fetch(`/api/items/${id}`)
    const data = await response.json()
    if (!response.ok) return setError(data.error || "Ticket not found")
    setItem(data.item)
    setForm(toForm(data.item))
  }

  useEffect(() => {
    load().catch(() => setError("The ticket could not be loaded."))
    // load is recreated each render and only needs to run when the ticket id changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function save() {
    if (!form) return
    setSaving(true)
    setError("")
    const response = await fetch(`/api/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    const data = await response.json()
    setSaving(false)
    if (!response.ok) return setError(data.error || "Could not save")
    setItem(data.item)
    setForm(toForm(data.item))
    setNotice("Saved")
  }

  async function changeStatus(status: string) {
    const response = await fetch(`/api/items/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    const data = await response.json()
    if (!response.ok) return setError(data.error || "Status did not change")
    setItem(data.item)
    setForm(toForm(data.item))
  }

  async function openPreview(kind: string, milestone?: number | null) {
    if (!form) return
    const response = await fetch(`/api/items/${id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "preview", kind, price: form.repairPrice, readyDate: form.estimateReadyOn, milestone }),
    })
    const data = await response.json()
    if (!response.ok) return setError(data.error || "Could not preview the text")
    setPreview({
      title: kind === "quote" ? "Quote text" : kind === "ready" ? "Pickup text" : "Reminder text",
      body: data.preview.body,
      to: data.preview.toDisplay || "No number",
      testMode: data.preview.testMode,
      warnings: data.preview.warnings ?? [],
      notes: data.preview.notes ?? [],
      kind,
      price: form.repairPrice,
      readyDate: form.estimateReadyOn,
      milestone,
    })
  }

  async function sendPreview() {
    if (!preview) return
    const response = await fetch(`/api/items/${id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "send",
        kind: preview.kind,
        text: preview.body,
        price: preview.price,
        readyDate: preview.readyDate,
        milestone: preview.milestone,
      }),
    })
    const data = await response.json()
    if (!response.ok) return setError(data.error || "The text was not sent")
    setItem(data.item)
    setForm(toForm(data.item))
    setNotice(data.testMode ? "Logged as not sent (test mode)." : "Text sent.")
    setPreview(null)
  }

  if (!item || !form) {
    return (
      <Shell>
        <p>{error || "Loading ticket…"}</p>
      </Shell>
    )
  }

  const timeline = [
    ...item.events.map((event) => ({ at: event.createdAt, title: statusLabel(event.toStatus), body: event.note, who: event.actor })),
    ...item.messages.map((message) => ({
      at: message.createdAt,
      title: message.direction === "inbound" ? "Text received" : message.status === "not_sent_test" ? "Not sent (test mode)" : message.status === "failed" ? "Text failed" : "Text sent",
      body: message.body,
      who: message.direction,
    })),
    ...item.calls.map((call) => ({ at: call.createdAt, title: `Call · ${call.outcome}`, body: call.note, who: "staff" })),
  ].sort((a, b) => a.at.localeCompare(b.at))

  return (
    <Shell>
      {params.get("new") === "1" && (
        <p className="mb-4 border border-ink bg-white px-3 py-2 text-sm">Ticket {item.ticketNumber} is saved. Every intake opens a profile, even before the customer fields are filled in.</p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">{statusLabel(item.status)}</p>
          <h1 className="serif text-4xl">{item.ticketNumber}</h1>
          <p className="text-sm text-muted">{formatWhen(item.createdAt)} · {lienStageLabel(item.lienStage)}</p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <Link className="border border-line px-3 py-2 text-xs uppercase tracking-[0.14em]" href={`/items/${item.id}/receipt`}>Receipt</Link>
          <Link className="border border-line px-3 py-2 text-xs uppercase tracking-[0.14em]" href={`/items/${item.id}/claim`}>Claim ticket</Link>
          <Link className="border border-line px-3 py-2 text-xs uppercase tracking-[0.14em]" href={`/items/${item.id}/shop-ticket`}>Shop ticket</Link>
          <Link className="border border-line px-3 py-2 text-xs uppercase tracking-[0.14em]" href={`/items/${item.id}/lien`}>§186 letter</Link>
          <button type="button" className="border border-line px-3 py-2 text-xs uppercase tracking-[0.14em]" onClick={() => share(item.ticketNumber)}>Share</button>
        </div>
      </div>
      {item.visionStatus === "no_key" && <p className="mt-4 border border-line bg-white px-3 py-2 text-sm">{item.visionMessage}</p>}
      {item.visionStatus === "error" && <p className="mt-4 border border-danger px-3 py-2 text-sm text-danger">{item.visionMessage}</p>}
      {item.captureWarning && <p className="mt-3 text-sm text-muted">{item.captureWarning}</p>}
      {notice && <p className="mt-3 text-sm">{notice}</p>}
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <div className="mt-5 flex gap-2 overflow-x-auto">
        {item.photos.map((photoItem) => (
          <button type="button" key={photoItem.id} onClick={() => setPhoto(photoItem.url)} className="h-28 w-24 shrink-0 border border-line bg-white">
            <img src={photoItem.thumbUrl} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>

      <section className="mt-6 grid gap-4 border border-line bg-white p-4">
        <h2 className="serif text-3xl">Customer</h2>
        <p className="text-sm text-muted">First name, last name, and mobile are enough to open the ticket. The rest can wait.</p>
        <CustomerFields value={form} onChange={(next) => setForm({ ...form, ...next })} />
        <Field label="Requested repair" value={form.requestedRepair} onChange={(requestedRepair) => setForm({ ...form, requestedRepair })} />
        <label>
          <Label>Description</Label>
          <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </label>
        <label>
          <Label>Damage notes</Label>
          <Textarea value={form.damageNotes} onChange={(event) => setForm({ ...form, damageNotes: event.target.value })} />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Quote" value={form.repairPrice} onChange={(repairPrice) => setForm({ ...form, repairPrice })} />
          <Field label="Deposit" value={form.deposit} onChange={(deposit) => setForm({ ...form, deposit })} />
          <label>
            <Label>Payment</Label>
            <select className="h-12 w-full border border-line bg-white px-3" value={form.paymentStatus} onChange={(event) => setForm({ ...form, paymentStatus: event.target.value as FormState["paymentStatus"] })}>
              <option value="unpaid">Unpaid</option>
              <option value="deposit">Deposit held</option>
              <option value="paid">Paid in full</option>
            </select>
          </label>
        </div>
        <Field label="Estimated ready date" value={form.estimateReadyOn} onChange={(estimateReadyOn) => setForm({ ...form, estimateReadyOn })} type="date" />
        <label>
          <Label>Staff notes</Label>
          <Textarea value={form.staffNotes} onChange={(event) => setForm({ ...form, staffNotes: event.target.value })} />
          <p className="mt-1 text-xs text-muted">Staff notes stay off receipts and the customer status page.</p>
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save profile"}</Button>
          <Button type="button" variant="outline" onClick={() => fetch(`/api/items/${id}/analyze`, { method: "POST" }).then((r) => r.json()).then((data) => { if (data.item) { setItem(data.item); setForm(toForm(data.item)) } else setError(data.error) })}>
            Write notes with AI
          </Button>
        </div>
      </section>

      <section className="mt-6 border border-line bg-white p-4">
        <h2 className="serif text-3xl">Status</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {STATUSES.map((status) => (
            <button key={status.id} type="button" className={`border px-3 py-2 text-xs uppercase tracking-[0.12em] ${item.status === status.id ? "border-ink bg-ink text-white" : "border-line"}`} onClick={() => changeStatus(status.id)}>
              {status.label}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => openPreview("quote")}>Preview quote text</Button>
          <Button type="button" variant="outline" onClick={() => openPreview("ready")}>Preview pickup text</Button>
          <Button type="button" variant="outline" onClick={() => openPreview("reminder_approval")}>Preview approval reminder</Button>
        </div>
        <p className="mt-3 text-sm text-muted">Quote {formatMoney(item.repairPriceCents)} · Balance {formatMoney(item.repairPriceCents == null ? null : Math.max(0, item.repairPriceCents - item.depositCents))}</p>
        {item.customerPhone && <a className="mt-2 inline-block text-sm underline" href={`tel:${item.customerPhone}`}>Call {formatPhone(item.customerPhone)}</a>}
        <div className="mt-3 grid gap-2 sm:grid-cols-[160px_1fr_auto]">
          <select className="h-12 border border-line bg-white px-2" value={callOutcome} onChange={(event) => setCallOutcome(event.target.value)}>
            <option value="spoke">Spoke</option>
            <option value="voicemail">Voicemail</option>
            <option value="no_answer">No answer</option>
            <option value="wrong_number">Wrong number</option>
          </select>
          <Input value={callNote} onChange={(event) => setCallNote(event.target.value)} placeholder="Call note" aria-label="Call note" />
          <Button type="button" variant="outline" onClick={async () => {
            const response = await fetch(`/api/items/${id}/calls`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome: callOutcome, note: callNote }) })
            const data = await response.json()
            if (response.ok) { setItem(data.item); setCallNote("") } else setError(data.error)
          }}>Log call</Button>
        </div>
      </section>

      <div className="mt-6">
        <WatchPanel item={item} onChange={(next) => { setItem(next); setForm(toForm(next)) }} />
      </div>

      <section className="no-print mt-6 border border-line bg-white p-4">
        <h2 className="serif text-3xl">Internal notes</h2>
        <p className="mt-1 text-sm text-muted">Only for the bench. Never printed and never shown to the customer.</p>
        <ul className="mt-3 space-y-2">
          {item.notes.map((entry) => (
            <li key={entry.id} className="border border-line px-3 py-2 text-sm">
              <p>{entry.body}</p>
              <p className="mt-1 text-xs text-muted">{entry.author} · {formatWhen(entry.createdAt)}</p>
            </li>
          ))}
        </ul>
        <div className="mt-3 grid gap-2">
          <Input value={author} onChange={(event) => setAuthor(event.target.value)} placeholder="Your name (staff, until logins exist)" aria-label="Note author" />
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Internal note" />
          <Button type="button" variant="outline" onClick={async () => {
            const response = await fetch(`/api/items/${id}/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: note, author: author || "Staff" }) })
            const data = await response.json()
            if (response.ok) { setItem(data.item); setNote("") } else setError(data.error)
          }}>Add note</Button>
        </div>
      </section>

      <LienBox item={item} onChange={setItem} />

      <section className="mt-6">
        <h2 className="serif text-3xl">Timeline</h2>
        <ol className="mt-3 space-y-3">
          {timeline.map((entry, index) => (
            <li key={`${entry.at}-${index}`} className="border-l border-ink pl-3">
              <p className="text-xs uppercase tracking-[0.14em] text-muted">{formatWhen(entry.at)} · {entry.who}</p>
              <p className="font-medium">{entry.title}</p>
              {entry.body && <p className="whitespace-pre-wrap text-sm">{entry.body}</p>}
            </li>
          ))}
        </ol>
      </section>

      {item.related.length > 0 && (
        <section className="mt-6">
          <h2 className="serif text-3xl">Other visits</h2>
          <ul className="mt-3 space-y-2">
            {item.related.map((visit) => (
              <li key={visit.id}>
                <Link href={`/items/${visit.id}`} className="underline">{visit.ticketNumber}</Link>
                <span className="text-sm text-muted"> · {statusLabel(visit.status)} · {formatWhen(visit.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <SignatureBox item={item} onChange={(next) => { setItem(next); setForm(toForm(next)) }} />

      <Dialog open={Boolean(preview)} title={preview?.title || "Text"} onClose={() => setPreview(null)}>
        {preview && (
          <div>
            <p className="text-sm">To {preview.to}</p>
            {preview.testMode && <p className="mt-2 text-sm">Twilio is not configured. This will be logged as not sent (test mode).</p>}
            {preview.warnings.map((warning) => <p key={warning} className="mt-2 text-sm text-danger">{warning}</p>)}
            {preview.notes.map((note) => <p key={note} className="mt-2 text-sm">{note}</p>)}
            <Textarea className="mt-3" value={preview.body} onChange={(event) => setPreview({ ...preview, body: event.target.value })} />
            <Button type="button" className="mt-3" onClick={sendPreview} disabled={preview.warnings.length > 0}>Send this text</Button>
          </div>
        )}
      </Dialog>
      <Dialog open={Boolean(photo)} title="Photo" onClose={() => setPhoto(null)}>
        {photo && <img src={photo} alt="Intake still" className="w-full" />}
      </Dialog>
    </Shell>
  )
}

function LienBox({ item, onChange }: { item: ShopItem; onChange: (item: ShopItem) => void }) {
  const [mailedOn, setMailedOn] = useState(item.noticeMailedOn ?? "")
  const [tracking, setTracking] = useState(item.noticeTracking ?? "")
  const [saleOn, setSaleOn] = useState("")
  const [price, setPrice] = useState("")
  const [expenses, setExpenses] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState("")
  if (!["at_risk", "eligible_notice", "notice_mailed", "eligible_sale", "sold"].includes(item.lienStage) && item.status !== "ready") return null
  return (
    <section className="mt-6 border border-line bg-white p-4">
      <h2 className="serif text-3xl">Lien timeline</h2>
      <p className="mt-2 text-sm">{LIEN_NOTE}</p>
      <p className="mt-2 text-sm">Stage: {lienStageLabel(item.lienStage)}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Input type="date" value={mailedOn} onChange={(event) => setMailedOn(event.target.value)} aria-label="Date notice was mailed" />
        <Input value={tracking} onChange={(event) => setTracking(event.target.value)} placeholder="Certified mail tracking number" aria-label="Tracking number" />
      </div>
      <Button type="button" className="mt-2" variant="outline" onClick={async () => {
        const response = await fetch(`/api/items/${item.id}/lien`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "mail", mailedOn, tracking }) })
        const data = await response.json()
        if (!response.ok) setError(data.error)
        else onChange(data.item)
      }}>Log mailing</Button>
      {item.lienStage === "eligible_sale" && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Input type="date" value={saleOn} onChange={(event) => setSaleOn(event.target.value)} aria-label="Sale date" />
          <Input value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Sale price" aria-label="Sale price" />
          <Input value={expenses} onChange={(event) => setExpenses(event.target.value)} placeholder="Sale expenses" aria-label="Sale expenses" />
          <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Sale note" aria-label="Sale note" />
          <Button type="button" onClick={async () => {
            const response = await fetch(`/api/items/${item.id}/lien`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sale", saleOn, price, expenses, note }) })
            const data = await response.json()
            if (!response.ok) setError(data.error)
            else onChange(data.item)
          }}>Record sale</Button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </section>
  )
}

function SignatureBox({ item, onChange }: { item: ShopItem; onChange: (item: ShopItem) => void }) {
  const [pad, setPad] = useState<HTMLCanvasElement | null>(null)
  async function save() {
    if (!pad) return
    const blob = await new Promise<Blob | null>((resolve) => pad.toBlob(resolve, "image/png"))
    if (!blob) return
    const form = new FormData()
    form.set("signature", blob, "signature.png")
    const response = await fetch(`/api/items/${item.id}/signature`, { method: "POST", body: form })
    const data = await response.json()
    if (response.ok) onChange(data.item)
  }
  return (
    <section className="no-print mt-6 border border-line bg-white p-4">
      <h2 className="serif text-3xl">Pickup signature</h2>
      <canvas
        ref={setPad}
        width={640}
        height={180}
        className="mt-3 w-full border border-line bg-paper touch-none"
        onPointerDown={(event) => draw(event, true)}
        onPointerMove={(event) => draw(event, false)}
      />
      <div className="mt-3 flex gap-2">
        <Button type="button" variant="outline" onClick={save}>Save signature</Button>
        {item.status !== "picked_up" && <Button type="button" onClick={async () => {
          await save()
          await fetch(`/api/items/${item.id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "picked_up", note: "Picked up. Signature on file." }) })
            .then((response) => response.json())
            .then((data) => data.item && onChange(data.item))
        }}>Confirm pickup</Button>}
      </div>
      {item.signatureUrl && <img src={item.signatureUrl} alt="Saved signature" className="mt-3 h-20 border border-line bg-white" />}
    </section>
  )
}

function draw(event: React.PointerEvent<HTMLCanvasElement>, start: boolean) {
  const canvas = event.currentTarget
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  const rect = canvas.getBoundingClientRect()
  const x = ((event.clientX - rect.left) / rect.width) * canvas.width
  const y = ((event.clientY - rect.top) / rect.height) * canvas.height
  ctx.lineWidth = 2
  ctx.lineCap = "round"
  ctx.strokeStyle = "#111"
  if (start) ctx.beginPath()
  ctx.lineTo(x, y)
  ctx.stroke()
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label>
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

type FormState = CustomerDraft & {
  requestedRepair: string
  staffNotes: string
  description: string
  damageNotes: string
  repairPrice: string
  deposit: string
  paymentStatus: "unpaid" | "deposit" | "paid"
  estimateReadyOn: string
}

function toForm(item: ShopItem): FormState {
  return {
    firstName: item.firstName,
    lastName: item.lastName,
    customerPhone: item.customerPhone,
    altPhone: item.altPhone,
    email: item.email,
    street: item.street,
    apt: item.apt,
    city: item.city,
    state: item.state || "NY",
    zip: item.zip,
    preferredContact: item.preferredContact,
    preferredLanguage: item.preferredLanguage || "English",
    smsConsent: item.smsConsent,
    emailConsent: item.emailConsent,
    heardAbout: item.heardAbout,
    customerNotes: item.customerNotes,
    requestedRepair: item.requestedRepair,
    staffNotes: item.staffNotes,
    description: item.description,
    damageNotes: item.damageNotes,
    repairPrice: dollarsToInput(item.repairPriceCents),
    deposit: dollarsToInput(item.depositCents),
    paymentStatus: item.paymentStatus,
    estimateReadyOn: item.estimateReadyOn ?? "",
  }
}

async function share(ticket: string) {
  const url = window.location.href
  if (navigator.share) {
    try {
      await navigator.share({ title: ticket, url })
      return
    } catch {
      return
    }
  }
  await navigator.clipboard.writeText(url)
}
