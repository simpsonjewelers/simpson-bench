import { Suspense } from "react"
import { ItemDetail } from "@/components/item-detail"

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <Suspense>
      <ItemDetail id={id} />
    </Suspense>
  )
}
