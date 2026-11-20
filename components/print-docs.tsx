import QRCode from "qrcode"
import { headers } from "next/headers"
import { PrintButton } from "@/components/print-button"
import { notFound } from "next/navigation"
import { brand } from "@/lib/brand"
import { balanceCents, formatDay, formatMoney, formatPhone, formatWhen, surplusCents } from "@/lib/format"
import { getItem, getSettings } from "@/lib/repo"
import { statusLabel } from "@/lib/statuses"

export const dynamic = "force-dynamic"

async function load(id: string) {
  const item = getItem(id)
  if (!item) notFound()
  const settings = getSettings()
  const h = await headers()
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3847"
  const proto = h.get("x-forwarded-proto") || "http"
  const base = process.env.PUBLIC_BASE_URL?.replace(/\/$/, "") || `${proto}://${host}`
  const url = `${base}/status?ticket=${encodeURIComponent(item.ticketNumber)}`
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 280, color: { dark: "#111111", light: "#ffffff" } })
  return { item, settings, qr, url }
}

export async function ReceiptPage({ id }: { id: string }) {
  const { item, settings, qr } = await load(id)
  const balance = balanceCents(item)
  return (
    <article className="print-sheet mx-auto max-w-3xl bg-white p-8 text-ink">
      <Header />
      <h1 className="serif mt-6 text-4xl">Condition receipt</h1>
      <p className="mt-1">{item.ticketNumber} · {formatWhen(item.createdAt)}</p>
      <p className="mt-4">{item.customerName}<br />{item.customerPhone ? formatPhone(item.customerPhone) : ""}<br />{item.customerAddress}</p>
      <p className="mt-4">Requested: {item.requestedRepair || "—"}</p>
      <h2 className="serif mt-6 text-2xl">Description</h2>
      <p className="whitespace-pre-wrap">{item.description || "—"}</p>
      <h2 className="serif mt-6 text-2xl">Condition at intake</h2>
      <p className="whitespace-pre-wrap">{item.damageNotes || "—"}</p>
      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {item.photos.map((photo) => (
          <img key={photo.id} src={photo.url} alt="" className="aspect-square w-full object-cover" />
        ))}
      </div>
      <p className="mt-6">Quote {formatMoney(item.repairPriceCents)} · Balance {formatMoney(balance)} · Ready {formatDay(item.estimateReadyOn)}</p>
      <p className="mt-6 text-sm">{settings.policyText}</p>
      <Qr qr={qr} />
      <p className="mt-6 text-xs text-muted">Photos show the piece as it was received. This note is a visual record, not an appraisal.</p>
      <PrintButton />
    </article>
  )
}

export async function ClaimPage({ id }: { id: string }) {
  const { item, settings, qr } = await load(id)
  return (
    <article className="print-sheet mx-auto max-w-md bg-white p-8">
      <Header />
      <h1 className="serif mt-6 text-4xl">Claim ticket</h1>
      <p className="serif mt-2 text-3xl">{item.ticketNumber}</p>
      <p>{formatWhen(item.createdAt)}</p>
      <p className="mt-4">{item.customerName}</p>
      <p>{item.description || item.requestedRepair}</p>
      {item.photos[0] && <img src={item.photos[0].url} alt="" className="mt-4 aspect-square w-full object-cover" />}
      <Qr qr={qr} />
      <p className="mt-4 text-sm">{settings.policyText}</p>
      <PrintButton />
    </article>
  )
}

export async function ShopTicketPage({ id }: { id: string }) {
  const { item } = await load(id)
  const total = item.ticketParts.reduce((sum, part) => sum + part.qty * part.unitCostCents, 0)
  return (
    <article className="print-sheet mx-auto max-w-3xl bg-white p-8">
      <Header />
      <h1 className="serif mt-6 text-4xl">Shop ticket</h1>
      <p>{item.ticketNumber} · {statusLabel(item.status)}</p>
      {item.watch?.isWatch && (
        <p className="mt-4">
          {item.watch.brand} {item.watch.model} · Ref {item.watch.referenceNo || "—"} · Caliber {item.watch.caliber || "—"} · Serial {item.watch.serialNo || "—"}
        </p>
      )}
      <h2 className="serif mt-6 text-2xl">Parts used</h2>
      <ul className="mt-2">
        {item.ticketParts.map((part) => (
          <li key={part.id}>{part.qty} × {part.partName} {part.partNumber} · {formatMoney(part.qty * part.unitCostCents)}</li>
        ))}
        {item.ticketParts.length === 0 && <li>No parts on this ticket.</li>}
      </ul>
      <p className="mt-3">Parts cost {formatMoney(total)}</p>
      <p className="mt-2 text-sm">Customer quote {formatMoney(item.repairPriceCents)}. Parts cost is the shop’s cost and is not the customer balance.</p>
      <PrintButton />
    </article>
  )
}

export async function LienPage({ id }: { id: string }) {
  const { item, settings } = await load(id)
  const balance = balanceCents(item)
  const sale = surplusCents({ salePriceCents: item.salePriceCents, saleExpensesCents: item.saleExpensesCents, balance })
  const deadline = item.noticeMailedOn ? addDays(item.noticeMailedOn, settings.redemptionDays) : null
  return (
    <article className="print-sheet mx-auto max-w-3xl bg-white p-8 leading-relaxed">
      <Header />
      <p className="mt-8">{formatDay(new Date().toISOString())}</p>
      <p className="mt-6 whitespace-pre-wrap">{item.customerName || "Owner"}{"\n"}{item.customerAddress || "Mailing address not on file"}</p>
      {!item.customerAddress && (
        <p className="mt-4 border border-ink p-3 text-sm">
          No mailing address is on file. NY Lien Law §186 allows notice by posting in two public places in the city only if the owner or the address is unknown. A text message is not this notice.
        </p>
      )}
      <h1 className="serif mt-8 text-3xl">Notice under New York Lien Law §186</h1>
      <p className="mt-4">Ticket {item.ticketNumber}</p>
      <p>Item: {item.description || item.requestedRepair || "Jewelry left for repair"}</p>
      {item.watch?.isWatch && <p>{item.watch.brand} {item.watch.model} {item.watch.referenceNo}</p>}
      <p>Work ready: {formatDay(item.readyAt)}</p>
      <p>Amount due for work and materials: {formatMoney(balance)}</p>
      <p className="mt-4">
        The account for labor and materials on the item described above has remained unpaid for one year after the work was completed. This is written notice that you may redeem the item by paying the amount due within {settings.redemptionDays} days.
      </p>
      <p className="mt-4">
        If the amount due is not paid within that time, {brand.name} may sell the item at public sale or bona fide private sale. The proceeds are applied to the expenses of the sale and then to the amount due. Any balance is paid to you.
      </p>
      <p className="mt-4">Redemption deadline: {deadline ? formatDay(deadline) : "30 days after this notice is mailed"}.</p>
      <p className="mt-4">This notice is given by mail to your last known address.</p>
      {item.noticeMailedOn && <p className="mt-4">Mailing logged {formatDay(item.noticeMailedOn)}. Tracking: {item.noticeTracking || "—"}.</p>}
      {sale && <p className="mt-4">Sale price {formatMoney(item.salePriceCents)}. Expenses {formatMoney(item.saleExpensesCents)}. Surplus owed to the owner {formatMoney(sale.surplus)}. Unpaid balance remaining {formatMoney(sale.remaining)}.</p>}
      <p className="mt-8 text-sm">Have an attorney review this letter before relying on it. A text message is not legal notice.</p>
      <PrintButton />
    </article>
  )
}

function Header() {
  return (
    <header>
      <img src={brand.logos.black} alt={brand.name} className="h-10 w-auto" />
      <p className="mt-3 text-sm">{brand.address}<br />{brand.phoneDisplay}<br />{brand.hoursShort}</p>
    </header>
  )
}

function Qr({ qr }: { qr: string }) {
  return (
    <div className="mt-6 flex items-center gap-4">
      <img src={qr} alt="QR code to the status page" className="h-28 w-28" />
      <p className="text-sm">Scan for repair status. You will need the ticket number and the last 4 digits of the phone on the ticket.</p>
    </div>
  )
}

function addDays(day: string, days: number): string {
  const [y, m, d] = day.slice(0, 10).split("-").map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
