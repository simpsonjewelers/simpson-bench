"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export type CustomerDraft = {
  firstName: string
  lastName: string
  customerPhone: string
  altPhone: string
  email: string
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
}

export const emptyCustomer: CustomerDraft = {
  firstName: "",
  lastName: "",
  customerPhone: "",
  altPhone: "",
  email: "",
  street: "",
  apt: "",
  city: "",
  state: "NY",
  zip: "",
  preferredContact: "text",
  preferredLanguage: "English",
  smsConsent: false,
  emailConsent: false,
  heardAbout: "",
  customerNotes: "",
}

type Match = CustomerDraft & { customerName: string }

export function CustomerFields({ value, onChange }: { value: CustomerDraft; onChange: (next: CustomerDraft) => void }) {
  const [matches, setMatches] = useState<Match[]>([])
  const [filled, setFilled] = useState("")
  const set = (patch: Partial<CustomerDraft>) => onChange({ ...value, ...patch })

  useEffect(() => {
    const phone = value.customerPhone.replace(/\D/g, "")
    const email = value.email.trim()
    if (phone.length < 7 && !email.includes("@")) {
      setMatches([])
      return
    }
    const timer = setTimeout(() => {
      const q = phone.length >= 7 ? value.customerPhone : email
      fetch(`/api/customers/match?q=${encodeURIComponent(q)}`)
        .then((response) => response.json())
        .then((data) => {
          const found = (data.matches ?? []) as Match[]
          setMatches(found)
          const exact = found.find((match) => {
            const samePhone = phone.length >= 10 && match.customerPhone.replace(/\D/g, "").endsWith(phone.slice(-10))
            const sameEmail = email.includes("@") && match.email.toLowerCase() === email.toLowerCase()
            return samePhone || sameEmail
          })
          if (exact && filled !== `${exact.customerPhone}|${exact.email}`) {
            onChange({ ...value, ...exact, customerPhone: value.customerPhone || exact.customerPhone, email: value.email || exact.email })
            setFilled(`${exact.customerPhone}|${exact.email}`)
          }
        })
        .catch(() => setMatches([]))
    }, 250)
    return () => clearTimeout(timer)
    // Autofill should run only when the phone or email field changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.customerPhone, value.email])

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <Label>First name</Label>
          <Input value={value.firstName} onChange={(event) => set({ firstName: event.target.value })} autoComplete="given-name" required />
        </label>
        <label>
          <Label>Last name</Label>
          <Input value={value.lastName} onChange={(event) => set({ lastName: event.target.value })} autoComplete="family-name" required />
        </label>
      </div>
      <label>
        <Label>Mobile phone</Label>
        <Input value={value.customerPhone} onChange={(event) => set({ customerPhone: event.target.value })} type="tel" inputMode="tel" autoComplete="tel" required />
      </label>
      {filled && <p className="text-sm">Filled from a returning customer. Change any field if this visit is different.</p>}
      {matches.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {matches.map((match) => (
            <button
              key={`${match.customerPhone}-${match.email}`}
              type="button"
              className="border border-line px-3 py-2 text-sm"
              onClick={() => {
                onChange({ ...match, customerPhone: match.customerPhone, email: match.email })
                setFilled(`${match.customerPhone}|${match.email}`)
              }}
            >
              {match.customerName || `${match.firstName} ${match.lastName}`}
            </button>
          ))}
        </div>
      )}
      <details className="border border-line bg-paper p-3">
        <summary className="cursor-pointer text-sm">More customer details</summary>
        <div className="mt-3 grid gap-3">
          <label>
            <Label>Alternate phone</Label>
            <Input value={value.altPhone} onChange={(event) => set({ altPhone: event.target.value })} type="tel" />
          </label>
          <label>
            <Label>Email</Label>
            <Input value={value.email} onChange={(event) => set({ email: event.target.value })} type="email" autoComplete="email" />
          </label>
          <label>
            <Label>Street</Label>
            <Input value={value.street} onChange={(event) => set({ street: event.target.value })} autoComplete="address-line1" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <Label>Apt</Label>
              <Input value={value.apt} onChange={(event) => set({ apt: event.target.value })} autoComplete="address-line2" />
            </label>
            <label>
              <Label>City</Label>
              <Input value={value.city} onChange={(event) => set({ city: event.target.value })} autoComplete="address-level2" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <Label>State</Label>
              <Input value={value.state} onChange={(event) => set({ state: event.target.value })} autoComplete="address-level1" />
            </label>
            <label>
              <Label>ZIP</Label>
              <Input value={value.zip} onChange={(event) => set({ zip: event.target.value })} inputMode="numeric" autoComplete="postal-code" />
            </label>
          </div>
          <label>
            <Label>Preferred contact</Label>
            <select className="h-12 w-full border border-line bg-white px-3" value={value.preferredContact} onChange={(event) => set({ preferredContact: event.target.value as CustomerDraft["preferredContact"] })}>
              <option value="text">Text</option>
              <option value="call">Call</option>
              <option value="email">Email</option>
            </select>
          </label>
          <label>
            <Label>Preferred language</Label>
            <select className="h-12 w-full border border-line bg-white px-3" value={value.preferredLanguage} onChange={(event) => set({ preferredLanguage: event.target.value })}>
              {["English", "Spanish", "Yiddish", "Hebrew", "Russian", "Other"].map((language) => (
                <option key={language}>{language}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={value.smsConsent} onChange={(event) => set({ smsConsent: event.target.checked })} />
            Agrees to text messages about this repair
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={value.emailConsent} onChange={(event) => set({ emailConsent: event.target.checked })} />
            Agrees to email about this repair
          </label>
          <label>
            <Label>How they heard about us</Label>
            <select className="h-12 w-full border border-line bg-white px-3" value={value.heardAbout} onChange={(event) => set({ heardAbout: event.target.value })}>
              <option value="">Select</option>
              {["Walk-in", "Friend", "Google", "Instagram", "Returning", "Other"].map((source) => (
                <option key={source}>{source}</option>
              ))}
            </select>
          </label>
          <label>
            <Label>Customer notes</Label>
            <Textarea value={value.customerNotes} onChange={(event) => set({ customerNotes: event.target.value })} />
          </label>
        </div>
      </details>
    </div>
  )
}
