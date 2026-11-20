import { brand } from "./brand"
import { sendEmail, smtpConfig } from "./mail"
import { formatDay, formatMoney, formatPhone, itemShort, normalizePhone } from "./format"
import {
  addMessage,
  findAwaitingByPhone,
  findByApprovalToken,
  findLatestByPhone,
  getItem,
  hasMessageSid,
  setStatus,
  templateBody,
  updateItem,
} from "./repo"
import { parseDecision } from "./decision"
import { reminderTemplateForDay, renderTemplate, withSignoff, type TemplateKey } from "./templates"
import type { ShopItem } from "./types"
import twilio from "twilio"

export function twilioConfig() {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim() ?? ""
  const token = process.env.TWILIO_AUTH_TOKEN?.trim() ?? ""
  const from = process.env.TWILIO_FROM_NUMBER?.trim() ?? ""
  return { sid, token, from, enabled: Boolean(sid && token && from) }
}

export function messageVars(item: ShopItem, base: string, extra: { price?: string; readyDate?: string; days?: string } = {}) {
  const price = extra.price ?? (item.repairPriceCents == null ? "" : formatMoney(item.repairPriceCents))
  const ready = extra.readyDate ?? (item.estimateReadyOn ? formatDay(item.estimateReadyOn) : "")
  return {
    ticket: item.ticketNumber,
    customer: item.customerName || "there",
    item: itemShort(item.description, item.watch),
    price,
    ready_date: ready || "a date we will confirm",
    days: extra.days ?? "",
    shop: brand.name,
    shop_phone: brand.phoneDisplay,
    hours: brand.hoursShort,
    status_url: base ? `${base}/status?ticket=${encodeURIComponent(item.ticketNumber)}` : "/status",
    approve_url: base ? `${base}/a/${item.approvalToken}` : `/a/${item.approvalToken}`,
    address: brand.address,
  }
}

export function renderItemTemplate(item: ShopItem, key: TemplateKey | string, base: string, extra?: { price?: string; readyDate?: string; days?: string }) {
  return withSignoff(renderTemplate(templateBody(key), messageVars(item, base, extra)))
}

export function previewText(item: ShopItem, body: string) {
  const phone = normalizePhone(item.customerPhone)
  const email = item.email?.trim() ?? ""
  const sms = Boolean(item.smsConsent && phone && item.preferredContact !== "email")
  const mail = Boolean(item.emailConsent && email && (item.preferredContact === "email" || item.emailConsent))
  const warnings: string[] = []
  const notes: string[] = []
  if (!sms && !mail) warnings.push("Turn on text or email consent, and add a mobile number or email, before sending.")
  if (sms && !twilioConfig().enabled) notes.push("Text will be logged as not sent (test mode).")
  if (mail && !smtpConfig().enabled) notes.push("Email will be logged as not sent (test mode).")
  if (item.preferredContact === "call") notes.push("They prefer a phone call. This still sends the consented text or email.")
  return {
    to: phone,
    toDisplay: [sms && phone ? formatPhone(phone) : "", mail ? email : ""].filter(Boolean).join(" and "),
    body,
    testMode: (sms && !twilioConfig().enabled) || (mail && !smtpConfig().enabled),
    sms,
    mail,
    warnings,
    notes,
  }
}

export async function sendText(input: {
  item: ShopItem
  body: string
  templateKey: string
  base: string
  after?: "quote" | "ready"
  price?: string | null
  readyDate?: string | null
}): Promise<{ item: ShopItem; testMode: boolean }> {
  const preview = previewText(input.item, input.body)
  if (preview.warnings.length || !preview.to && !preview.mail) {
    throw new Error(preview.warnings[0] || "This message is not ready to send.")
  }
  const mode = twilioConfig()
  if (preview.sms && preview.to) {
    let sid: string | null = null
    let status = "not_sent_test"
    if (mode.enabled) {
      try {
        sid = await postTwilio(mode.sid, mode.token, mode.from, preview.to, input.body, callbackUrl(input.base))
        status = "sent"
      } catch (error) {
        const message = error instanceof Error ? error.message : "Text failed"
        addMessage({
          itemId: input.item.id,
          direction: "outbound",
          body: input.body,
          toPhone: preview.to,
          fromPhone: mode.from,
          templateKey: input.templateKey,
          status: "failed",
          error: message,
        })
        throw new Error(message)
      }
    }
    addMessage({
      itemId: input.item.id,
      direction: "outbound",
      body: input.body,
      toPhone: preview.to,
      fromPhone: mode.enabled ? mode.from : null,
      templateKey: input.templateKey,
      status,
      twilioSid: sid,
      delivery: mode.enabled ? "queued" : null,
    })
  }
  if (preview.mail && input.item.email) {
    const smtp = smtpConfig()
    let status = "not_sent_test"
    try {
      const result = await sendEmail(input.item.email, `${brand.name} ${input.item.ticketNumber}`, input.body)
      status = result.testMode ? "not_sent_test" : "sent"
    } catch (error) {
      const message = error instanceof Error ? error.message : "Email failed"
      addMessage({
        itemId: input.item.id,
        direction: "outbound",
        body: input.body,
        toPhone: input.item.email,
        templateKey: `${input.templateKey}:email`,
        status: "failed",
        error: message,
      })
      if (!preview.sms) throw new Error(message)
    }
    if (status !== "failed") {
      addMessage({
        itemId: input.item.id,
        direction: "outbound",
        body: input.body,
        toPhone: input.item.email,
        fromPhone: smtp.from,
        templateKey: `${input.templateKey}:email`,
        status,
        delivery: status === "sent" ? "email" : "email-test",
      })
    }
  }
  if (input.after === "quote") {
    updateItem(input.item.id, {
      repairPrice: input.price ?? null,
      estimateReadyOn: input.readyDate ?? null,
    })
    const fresh = getItem(input.item.id)!
    if (fresh.status !== "awaiting_approval" && !["in_repair", "ready", "picked_up", "sold"].includes(fresh.status)) {
      setStatus(fresh.id, "awaiting_approval", preview.testMode ? "Quote prepared. Message not sent (test mode)." : "Quote sent.", "staff")
    }
  }
  if (input.after === "ready") {
    const fresh = getItem(input.item.id)!
    if (!["ready", "picked_up", "sold", "declined"].includes(fresh.status)) {
      setStatus(fresh.id, "ready", mode.enabled ? "Marked ready and customer texted." : "Marked ready. Text not sent (test mode).", "staff")
    }
  }
  return { item: getItem(input.item.id)!, testMode: !mode.enabled }
}

export function reminderKey(kind: "reminder_approval" | "reminder_pickup", milestone: number | null, thresholds: number[]): string {
  if (kind === "reminder_approval") return "reminder_approval"
  const template = milestone ? reminderTemplateForDay(milestone, thresholds) : "reminder_pickup"
  return milestone ? `${template}@${milestone}` : template
}

export function handleInbound(params: Record<string, string>, base: string): string {
  const sid = params.MessageSid || ""
  if (sid && hasMessageSid(sid)) return twiml("")
  const from = normalizePhone(params.From || "")
  const body = params.Body || ""
  const decision = parseDecision(body)
  if (decision === "stop") {
    const item = from ? findLatestByPhone(from) : null
    if (item) {
      addMessage({
        itemId: item.id,
        direction: "inbound",
        body,
        fromPhone: from,
        toPhone: params.To || null,
        status: "received",
        twilioSid: sid || null,
      })
    }
    return twiml("")
  }
  const waiting = from ? findAwaitingByPhone(from) : null
  const item = waiting ?? (from ? findLatestByPhone(from) : null)
  if (!item) return twiml(withSignoff(templateBody("reply_unmatched")))
  addMessage({
    itemId: item.id,
    direction: "inbound",
    body,
    fromPhone: from,
    toPhone: params.To || null,
    templateKey: decision === "yes" || decision === "no" ? decision : null,
    status: "received",
    twilioSid: sid || null,
  })
  if (!waiting || !decision) {
    return twiml(renderItemTemplate(item, waiting ? "reply_unknown" : "reply_unmatched", base))
  }
  if (decision === "yes") {
    setStatus(item.id, "in_repair", "Customer replied YES by text.", "customer")
    return twiml(renderItemTemplate(getItem(item.id)!, "reply_yes", base))
  }
  setStatus(item.id, "declined", "Customer replied NO by text.", "customer")
  return twiml(renderItemTemplate(getItem(item.id)!, "reply_no", base))
}

export function decideFromPage(token: string, decision: "yes" | "no"): { already: boolean; item: ShopItem } {
  const item = findByApprovalToken(token)
  if (!item) throw new Error("This approval link is not valid.")
  if (item.status !== "awaiting_approval") return { already: true, item }
  addMessage({
    itemId: item.id,
    direction: "inbound",
    body: decision === "yes" ? "YES (approval page)" : "NO (approval page)",
    fromPhone: item.customerPhone,
    templateKey: decision,
    status: "received",
  })
  const next = decision === "yes" ? "in_repair" : "declined"
  const note = decision === "yes" ? "Customer approved on the web page." : "Customer declined on the web page."
  const updated = setStatus(item.id, next, note, "customer")
  return { already: false, item: updated }
}

export function validateTwilio(requestUrl: string, params: Record<string, string>, signature: string): boolean {
  const { token, enabled } = twilioConfig()
  if (!enabled) return false
  return twilio.validateRequest(token, signature, requestUrl, params)
}

async function postTwilio(sid: string, token: string, from: string, to: string, body: string, statusCallback: string) {
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ From: from, To: to, Body: body, ...(statusCallback ? { StatusCallback: statusCallback } : {}) }),
  })
  const payload = (await response.json().catch(() => ({}))) as { message?: string; sid?: string }
  if (!response.ok) throw new Error(payload.message || `Twilio returned ${response.status}`)
  return payload.sid ?? null
}

function callbackUrl(base: string): string {
  if (!base || /localhost|127\.0\.0\.1/.test(base)) return ""
  return `${base}/api/twilio/status`
}

function twiml(message: string): string {
  const response = new twilio.twiml.MessagingResponse()
  if (message.trim()) response.message(message)
  return response.toString()
}
