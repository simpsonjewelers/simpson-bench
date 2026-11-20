import { LienPage } from "@/components/print-docs"

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <LienPage id={id} />
}
