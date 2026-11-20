import { brand } from "@/lib/brand"
import { twilioConfig } from "@/lib/sms"
import { visionConfigured } from "@/lib/vision"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  return Response.json({
    shopName: brand.name,
    visionConfigured: visionConfigured(),
    twilioMode: twilioConfig().enabled ? "live" : "test",
    demoMode: process.env.DEMO_MODE === "1" || process.env.DEMO_MODE === "true",
  })
}
