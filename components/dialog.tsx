"use client"

export function Dialog({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  if (!open) return null
  return (
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true">
      <div className="max-h-[92dvh] w-full max-w-lg overflow-auto bg-white p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="serif text-3xl">{title}</h2>
          <button type="button" className="text-sm uppercase tracking-[0.14em]" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
