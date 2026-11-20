export const STATUSES = [
  { id: "received", label: "Received", customer: "We have your piece." },
  { id: "inspecting", label: "Inspecting", customer: "We are inspecting your piece." },
  { id: "awaiting_approval", label: "Awaiting customer approval", customer: "Waiting for your approval of the estimate." },
  { id: "in_repair", label: "Approved / In repair", customer: "Your repair is approved and in progress." },
  { id: "ready", label: "Ready for pickup", customer: "Your piece is ready for pickup." },
  { id: "picked_up", label: "Picked up", customer: "This piece has been picked up." },
  { id: "declined", label: "Declined", customer: "The repair was declined. Please call the shop about pickup." },
  { id: "sold", label: "Sold", customer: "Please call the shop about this ticket." },
] as const

export type StatusId = (typeof STATUSES)[number]["id"]

export const IN_PROGRESS: StatusId[] = ["received", "inspecting", "awaiting_approval", "in_repair"]

export function isStatus(value: string): value is StatusId {
  return STATUSES.some((status) => status.id === value)
}

export function statusLabel(value: string): string {
  return STATUSES.find((status) => status.id === value)?.label ?? value
}

export function customerStatusLabel(value: string): string {
  return STATUSES.find((status) => status.id === value)?.customer ?? "Please call the shop."
}

export function inProgress(value: string): boolean {
  return (IN_PROGRESS as string[]).includes(value)
}
