import { parseCatalogCsv, type CatalogDraft } from "@/lib/catalog"
import { jsonError } from "@/lib/http"
import { deleteCatalogPart, importCatalog, listCatalog, saveCatalogPart } from "@/lib/repo"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? ""
  return Response.json({ parts: listCatalog(q) })
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || ""
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as Partial<CatalogDraft> & { id?: string; csv?: string }
      if (body.csv) {
        const rows = parseCatalogCsv(body.csv)
        if (!rows.length) return jsonError("No part rows were found in that CSV.")
        return Response.json(importCatalog(rows))
      }
      return Response.json({
        part: saveCatalogPart({
          id: body.id,
          brand: body.brand ?? "",
          model: body.model ?? "",
          referenceNo: body.referenceNo ?? "",
          caliber: body.caliber ?? "",
          partName: body.partName ?? "",
          partNumber: body.partNumber ?? "",
          notes: body.notes ?? "",
        }),
      })
    }
    const form = await request.formData()
    const file = form.get("file")
    if (!(file instanceof File)) return jsonError("Choose a CSV file.")
    const rows = parseCatalogCsv(await file.text())
    if (!rows.length) return jsonError("No part rows were found in that CSV.")
    return Response.json(importCatalog(rows))
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "The catalog could not be saved.")
  }
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id")
  if (!id) return jsonError("Choose a catalog row.")
  deleteCatalogPart(id)
  return Response.json({ ok: true })
}
