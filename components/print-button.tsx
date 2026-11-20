"use client"

import Link from "next/link"

export function PrintButton() {
  return (
    <p className="no-print mt-6">
      <button type="button" className="border border-ink bg-ink px-4 py-2 text-sm text-white" onClick={() => window.print()}>
        Print
      </button>
      <Link href="/" className="ml-4 text-sm underline">Back to the bench</Link>
    </p>
  )
}
