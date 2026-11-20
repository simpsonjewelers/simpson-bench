import { jsonError } from "@/lib/http"
import { getSettings, saveSettings } from "@/lib/repo"
import type { ShopSettings } from "@/lib/policy"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  return Response.json({ settings: getSettings() })
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as Partial<ShopSettings>
    return Response.json({ settings: saveSettings(body) })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Settings could not be saved.")
  }
}
