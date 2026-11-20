"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Shell } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { LIEN_NOTE } from "@/lib/policy"
import type { MessageTemplate } from "@/lib/templates"
import type { ShopSettings } from "@/lib/policy"

export function SettingsClient() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [settings, setSettings] = useState<ShopSettings | null>(null)
  const [mode, setMode] = useState("")
  const [notice, setNotice] = useState("")

  useEffect(() => {
    fetch("/api/templates").then((response) => response.json()).then((data) => setTemplates(data.templates ?? []))
    fetch("/api/settings").then((response) => response.json()).then((data) => setSettings(data.settings))
    fetch("/api/config").then((response) => response.json()).then((data) => setMode(data.twilioMode === "live" ? "Twilio is live." : "Twilio is in test mode. Texts are logged as not sent."))
  }, [])

  return (
    <Shell>
      <p className="text-xs uppercase tracking-[0.18em] text-muted">Settings</p>
      <h1 className="serif text-4xl">Texts and policy</h1>
      <p className="mt-2 text-sm text-muted">{mode}</p>
      <p className="mt-2 max-w-2xl text-sm">{LIEN_NOTE}</p>
      <Link href="/texts" className="mt-3 inline-block text-sm underline">Preview how texts look on a phone</Link>
      {settings && (
        <form
          className="mt-6 grid gap-3 border border-line bg-white p-4"
          onSubmit={async (event) => {
            event.preventDefault()
            const response = await fetch("/api/settings", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(settings),
            })
            const data = await response.json()
            setSettings(data.settings)
            setNotice("Policy saved.")
          }}
        >
          <label className="text-sm">
            Courtesy reminder days after ready, comma separated
            <input className="mt-1 h-12 w-full border border-line px-3" value={settings.reminderDays.join(", ")} onChange={(event) => setSettings({ ...settings, reminderDays: event.target.value.split(",").map((part) => Number(part.trim())).filter((n) => n > 0) })} />
          </label>
          <label className="text-sm">
            Days after ready before a §186 notice may be mailed (default 365)
            <input className="mt-1 h-12 w-full border border-line px-3" type="number" value={settings.lienAfterDays} onChange={(event) => setSettings({ ...settings, lienAfterDays: Number(event.target.value) })} />
          </label>
          <label className="text-sm">
            Days after mailing before the piece is eligible for sale
            <input className="mt-1 h-12 w-full border border-line px-3" type="number" value={settings.redemptionDays} onChange={(event) => setSettings({ ...settings, redemptionDays: Number(event.target.value) })} />
          </label>
          <label className="text-sm">
            Claim ticket / receipt policy text
            <Textarea className="mt-1" value={settings.policyText} onChange={(event) => setSettings({ ...settings, policyText: event.target.value })} />
          </label>
          <Button type="submit">Save policy</Button>
        </form>
      )}
      <form
        className="mt-6 space-y-4"
        onSubmit={async (event) => {
          event.preventDefault()
          await fetch("/api/templates", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ templates: templates.map((template) => ({ key: template.key, body: template.body })) }),
          })
          setNotice("Templates saved. Each text still signs off as Simpson Jewelers with the shop phone.")
        }}
      >
        {templates.map((template, index) => (
          <label key={template.key} className="block border border-line bg-white p-4">
            <span className="text-xs uppercase tracking-[0.16em] text-muted">{template.label}</span>
            <Textarea className="mt-2" value={template.body} onChange={(event) => setTemplates(templates.map((row, rowIndex) => rowIndex === index ? { ...row, body: event.target.value } : row))} />
          </label>
        ))}
        <Button type="submit">Save templates</Button>
      </form>
      {notice && <p className="mt-3">{notice}</p>}
    </Shell>
  )
}
