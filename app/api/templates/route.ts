import { jsonError } from "@/lib/http"
import { getTemplates, saveTemplates } from "@/lib/repo"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  return Response.json({ templates: getTemplates() })
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { templates?: { key: string; body: string }[] }
    return Response.json({ templates: saveTemplates(body.templates ?? []) })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Templates could not be saved.")
  }
}
