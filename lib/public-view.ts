import { brand } from "./brand"
import { balanceCents, formatMoney, itemShort } from "./format"
import { customerStatusLabel } from "./statuses"
import type { ShopItem } from "./types"

export function toPublicStatus(item: ShopItem) {
  const balance = balanceCents(item)
  return {
    ticketNumber: item.ticketNumber,
    status: item.status,
    statusLabel: customerStatusLabel(item.status),
    description: itemShort(item.description, item.watch),
    estimateReadyOn: item.estimateReadyOn,
    quote: item.repairPriceCents == null ? null : formatMoney(item.repairPriceCents),
    balance: balance == null ? null : formatMoney(balance),
    shop: {
      name: brand.name,
      address: brand.address,
      phoneDisplay: brand.phoneDisplay,
      phoneTel: brand.phoneTel,
      email: brand.email,
      website: brand.website,
      hours: brand.hours,
      hoursShort: brand.hoursShort,
    },
  }
}

export function toReceipt(item: ShopItem) {
  return {
    ticketNumber: item.ticketNumber,
    createdAt: item.createdAt,
    customerName: item.customerName,
    customerPhone: item.customerPhone,
    customerAddress: item.customerAddress,
    requestedRepair: item.requestedRepair,
    description: item.description,
    damageNotes: item.damageNotes,
    repairPriceCents: item.repairPriceCents,
    depositCents: item.depositCents,
    paymentStatus: item.paymentStatus,
    estimateReadyOn: item.estimateReadyOn,
    status: item.status,
    photos: item.photos.map((photo) => ({ id: photo.id, url: photo.url })),
  }
}
