"use client"

import { useEffect, useState } from "react"
import { Shell } from "@/components/shell"
import { brand } from "@/lib/brand"
import { previewDaysForTemplate, renderTemplate, withSignoff, type MessageTemplate } from "@/lib/templates"
import { DEFAULT_SETTINGS } from "@/lib/policy"

const sample = {
  ticket: "SJ-261120-014",
  customer: "Ruth Adler",
  item: "yellow gold ring",
  price: "$185.00",
  ready_date: "Dec 2",
  shop: brand.name,
  shop_phone: brand.phoneDisplay,
  hours: brand.hoursShort,
  status_url: "https://simpsonjewelers.com/status?ticket=SJ-261120-014",
  approve_url: "https://simpsonjewelers.com/a/sample",
  address: brand.address,
}

export function TextPreview() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [thresholds, setThresholds] = useState<number[]>([...DEFAULT_SETTINGS.reminderDays])
  useEffect(() => {
    fetch("/api/templates").then((response) => response.json()).then((data) => setTemplates(data.templates ?? []))
    fetch("/api/settings").then((response) => response.json()).then((data) => {
      if (Array.isArray(data.settings?.reminderDays)) setThresholds(data.settings.reminderDays)
    })
  }, [])
  const shown = templates.filter((template) => ["quote", "reminder_approval", "ready", "reminder_pickup", "reminder_firm", "reminder_final"].includes(template.key))
  return (
    <Shell>
      <p className="text-xs uppercase tracking-[0.18em] text-muted">Customer texts</p>
      <h1 className="serif text-4xl">How the messages read</h1>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        {shown.map((template) => (
          <div key={template.key} className="mx-auto w-full max-w-sm rounded-[2rem] border border-ink bg-ink p-3 text-white">
            <p className="mb-2 text-center text-xs uppercase tracking-[0.16em] text-white/70">{template.label}</p>
            <div className="rounded-2xl bg-[#f2f2f2] p-4 text-sm text-ink whitespace-pre-wrap">
              {withSignoff(renderTemplate(template.body, { ...sample, days: previewDaysForTemplate(template.key, thresholds) }))}
            </div>
          </div>
        ))}
      </div>
    </Shell>
  )
}
