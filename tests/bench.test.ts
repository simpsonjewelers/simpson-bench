import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { catalogMatchesWatch, parseCatalogCsv } from "../lib/catalog"
import { previewDaysForTemplate } from "../lib/templates"
import { computeLienStage, DEFAULT_SETTINGS, dueReminder } from "../lib/policy"
import { toPublicStatus, toReceipt } from "../lib/public-view"
import type { ShopItem } from "../lib/types"

describe("catalog", () => {
  it("matches the same reference and hides nothing about suppliers", () => {
    const watch = { brand: "Seiko", model: "5", referenceNo: "SNK809", caliber: "7S26" }
    assert.equal(catalogMatchesWatch({ brand: "seiko", model: "", referenceNo: "snk809", caliber: "" }, watch), true)
    assert.equal(catalogMatchesWatch({ brand: "Rolex", model: "Datejust", referenceNo: "126234", caliber: "3235" }, watch), false)
  })

  it("gives each reminder template its own day count", () => {
    const days = [30, 60, 90, 180]
    assert.equal(previewDaysForTemplate("reminder_pickup", days), "30")
    assert.equal(previewDaysForTemplate("reminder_firm", days), "90")
    assert.equal(previewDaysForTemplate("reminder_final", days), "180")
  })

  it("parses a brand parts CSV", () => {
    const rows = parseCatalogCsv("brand,model,reference,caliber,part_name,part_number,notes\nSeiko,5,SNK809,7S26,Crystal,DEMO-CRYSTAL,sample\n")
    assert.equal(rows.length, 1)
    assert.equal(rows[0].partNumber, "DEMO-CRYSTAL")
  })
})

describe("lien policy", () => {
  it("flags a one-year-ready watch for written notice", () => {
    const readyAt = new Date(Date.now() - 370 * 86400000).toISOString()
    assert.equal(
      computeLienStage({ status: "ready", readyAt, noticeMailedOn: null, lienStage: "none", paymentStatus: "unpaid" }, DEFAULT_SETTINGS),
      "eligible_notice",
    )
  })

  it("becomes eligible for sale 30 days after the mailing is logged", () => {
    const mailed = new Date(Date.now() - 40 * 86400000).toISOString().slice(0, 10)
    assert.equal(
      computeLienStage(
        { status: "ready", readyAt: new Date(Date.now() - 400 * 86400000).toISOString(), noticeMailedOn: mailed, lienStage: "notice_mailed", paymentStatus: "unpaid" },
        DEFAULT_SETTINGS,
      ),
      "eligible_sale",
    )
  })

  it("queues only the latest unsent courtesy reminder", () => {
    assert.equal(dueReminder(200, [], [30, 60, 90, 180]), 180)
    assert.equal(dueReminder(70, [30], [30, 60, 90, 180]), 60)
    assert.equal(dueReminder(200, [180], [30, 60, 90, 180]), null)
  })
})

describe("customer view", () => {
  it("omits internal notes, serials, and part costs", () => {
    const item = {
      id: "1",
      ticketNumber: "SJ-261120-014",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "ready",
      statusChangedAt: new Date().toISOString(),
      customerName: "Ruth Adler",
      firstName: "Ruth",
      lastName: "Adler",
      customerPhone: "+17185550142",
      altPhone: "",
      email: "",
      customerAddress: "1842 47th St",
      street: "1842 47th St",
      apt: "",
      city: "Brooklyn",
      state: "NY",
      zip: "11204",
      preferredContact: "text",
      preferredLanguage: "English",
      smsConsent: true,
      emailConsent: false,
      heardAbout: "",
      customerNotes: "",
      requestedRepair: "Resize",
      staffNotes: "secret staff note",
      description: "Appears to be a yellow gold ring.",
      damageNotes: "A scratch appears on the shank.",
      visionStatus: "no_key",
      visionMessage: null,
      captureWarning: null,
      repairPriceCents: 18500,
      estimateReadyOn: "2026-12-02",
      depositCents: 5000,
      paymentStatus: "deposit",
      approvalToken: "tok",
      quotedAt: null,
      readyAt: null,
      pickedUpAt: null,
      signatureUrl: null,
      lienStage: "none",
      noticeMailedOn: null,
      noticeTracking: null,
      saleOn: null,
      salePriceCents: null,
      saleExpensesCents: null,
      saleNote: null,
      photos: [],
      events: [],
      messages: [],
      notes: [{ id: "n", body: "secret internal note", author: "Staff", createdAt: new Date().toISOString() }],
      calls: [],
      watch: {
        isWatch: false,
        brand: "",
        model: "",
        referenceNo: "",
        serialNo: "SECRETSERIAL",
        caseSize: "",
        caseMaterial: "",
        dial: "",
        movementType: "unknown",
        caliber: "",
        confidence: "",
        confidenceNote: "",
        needsCaseback: false,
        needsDial: false,
        visibleText: [],
        suggestedParts: [],
        confirmed: false,
      },
      catalogParts: [],
      ticketParts: [{ id: "p", partName: "Crystal", partNumber: "X", qty: 1, unitCostCents: 4000, source: "catalog", createdAt: new Date().toISOString() }],
      partsSource: "none",
      related: [],
    } satisfies ShopItem
    const pub = JSON.stringify(toPublicStatus(item))
    const receipt = JSON.stringify(toReceipt(item))
    assert.equal(pub.includes("secret internal note"), false)
    assert.equal(pub.includes("SECRETSERIAL"), false)
    assert.equal(pub.includes("4000"), false)
    assert.equal(receipt.includes("secret staff note"), false)
    assert.equal(receipt.includes("secret internal note"), false)
    assert.equal(receipt.includes("Crystal"), false)
  })
})
