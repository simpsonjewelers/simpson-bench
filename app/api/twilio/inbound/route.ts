import { webhookUrl } from "@/lib/http"
import { handleInbound, validateTwilio } from "@/lib/sms"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const form = await request.formData()
  const params: Record<string, string> = {}
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") params[key] = value
  }
  const signature = request.headers.get("x-twilio-signature") ?? ""
  if (!validateTwilio(webhookUrl(request), params, signature)) {
    return new Response("Forbidden", { status: 403 })
  }
  const xml = handleInbound(params, webhookUrl(request).replace(/\/api\/twilio\/inbound.*$/, ""))
  return new Response(xml, { headers: { "Content-Type": "text/xml" } })
}
