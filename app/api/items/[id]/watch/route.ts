import { jsonError } from "@/lib/http"
import { saveWatch } from "@/lib/repo"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const body = (await request.json()) as {
      isWatch?: boolean
      brand?: string
      model?: string
      referenceNo?: string
      serialNo?: string
      caseSize?: string
      caseMaterial?: string
      dial?: string
      movementType?: string
      caliber?: string
      confirmed?: boolean
    }
    return Response.json({
      item: saveWatch(id, {
        isWatch: Boolean(body.isWatch),
        brand: body.brand ?? "",
        model: body.model ?? "",
        referenceNo: body.referenceNo ?? "",
        serialNo: body.serialNo ?? "",
        caseSize: body.caseSize ?? "",
        caseMaterial: body.caseMaterial ?? "",
        dial: body.dial ?? "",
        movementType: body.movementType ?? "unknown",
        caliber: body.caliber ?? "",
        confirmed: Boolean(body.confirmed),
      }),
    })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "The watch details could not be saved.")
  }
}
