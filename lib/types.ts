import type { SuggestedPart } from "./catalog"
import type { LienStage } from "./policy"
import type { StatusId } from "./statuses"

export type VisionStatus = "ok" | "no_key" | "error"
export type PaymentStatus = "unpaid" | "deposit" | "paid"
export type MovementType = "automatic" | "manual" | "quartz" | "unknown"

export type Photo = {
  id: string
  url: string
  thumbUrl: string
  sortOrder: number
  sharpness: number
  timestampSec: number
}

export type StatusEvent = {
  id: string
  fromStatus: string | null
  toStatus: string
  note: string
  actor: string
  createdAt: string
}

export type ShopMessage = {
  id: string
  direction: "outbound" | "inbound"
  body: string
  toPhone: string | null
  fromPhone: string | null
  templateKey: string | null
  status: string
  delivery: string | null
  error: string | null
  createdAt: string
}

export type InternalNote = {
  id: string
  body: string
  author: string
  createdAt: string
}

export type CallLog = {
  id: string
  outcome: string
  note: string
  createdAt: string
}

export type WatchProfile = {
  isWatch: boolean
  brand: string
  model: string
  referenceNo: string
  serialNo: string
  caseSize: string
  caseMaterial: string
  dial: string
  movementType: MovementType | string
  caliber: string
  confidence: string
  confidenceNote: string
  needsCaseback: boolean
  needsDial: boolean
  visibleText: string[]
  suggestedParts: SuggestedPart[]
  confirmed: boolean
}

export type CatalogPart = {
  id: string
  brand: string
  model: string
  referenceNo: string
  caliber: string
  partName: string
  partNumber: string
  notes: string
  updatedAt: string
}

export type TicketPart = {
  id: string
  partName: string
  partNumber: string
  qty: number
  unitCostCents: number
  source: "catalog" | "unverified" | "manual"
  createdAt: string
}

export type ItemSummary = {
  id: string
  ticketNumber: string
  createdAt: string
  status: StatusId
  customerName: string
  customerPhone: string
  description: string
  requestedRepair: string
  repairPriceCents: number | null
  estimateReadyOn: string | null
  quotedAt: string | null
  readyAt: string | null
  lienStage: LienStage
  thumbUrl: string | null
  daysInShop: number
  overdue: boolean
}

export type ReportRow = ItemSummary & {
  customerAddress: string
  daysWaiting: number | null
  daysSinceReady: number | null
  balanceCents: number | null
  followups: number
  reminders: number
  lastContactAt: string | null
  dueMilestone: number | null
  noticeMailedOn: string | null
  noticeTracking: string | null
}

export type RelatedTicket = {
  id: string
  ticketNumber: string
  createdAt: string
  status: StatusId | string
  customerName: string
  requestedRepair: string
}

export type ShopItem = {
  id: string
  ticketNumber: string
  createdAt: string
  updatedAt: string
  status: StatusId
  statusChangedAt: string
  customerName: string
  firstName: string
  lastName: string
  customerPhone: string
  altPhone: string
  email: string
  customerAddress: string
  street: string
  apt: string
  city: string
  state: string
  zip: string
  preferredContact: "text" | "call" | "email"
  preferredLanguage: string
  smsConsent: boolean
  emailConsent: boolean
  heardAbout: string
  customerNotes: string
  requestedRepair: string
  staffNotes: string
  description: string
  damageNotes: string
  visionStatus: VisionStatus
  visionMessage: string | null
  captureWarning: string | null
  repairPriceCents: number | null
  estimateReadyOn: string | null
  depositCents: number
  paymentStatus: PaymentStatus
  approvalToken: string
  quotedAt: string | null
  readyAt: string | null
  pickedUpAt: string | null
  signatureUrl: string | null
  lienStage: LienStage
  noticeMailedOn: string | null
  noticeTracking: string | null
  saleOn: string | null
  salePriceCents: number | null
  saleExpensesCents: number | null
  saleNote: string | null
  photos: Photo[]
  events: StatusEvent[]
  messages: ShopMessage[]
  notes: InternalNote[]
  calls: CallLog[]
  watch: WatchProfile | null
  catalogParts: CatalogPart[]
  ticketParts: TicketPart[]
  partsSource: "catalog" | "unverified" | "none"
  related: RelatedTicket[]
}
