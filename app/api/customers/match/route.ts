import { jsonError } from "@/lib/http"
import { matchCustomers } from "@/lib/repo"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams.get("q") ?? ""
    const matches = matchCustomers(q).map((item) => ({
      customerName: item.customerName,
      firstName: item.firstName,
      lastName: item.lastName,
      customerPhone: item.customerPhone,
      altPhone: item.altPhone,
      email: item.email,
      street: item.street,
      apt: item.apt,
      city: item.city,
      state: item.state,
      zip: item.zip,
      preferredContact: item.preferredContact,
      preferredLanguage: item.preferredLanguage,
      smsConsent: item.smsConsent,
      emailConsent: item.emailConsent,
      heardAbout: item.heardAbout,
      customerNotes: item.customerNotes,
    }))
    return Response.json({ matches })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Lookup failed.", 500)
  }
}
