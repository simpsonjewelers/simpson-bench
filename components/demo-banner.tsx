"use client"

import { useEffect, useState } from "react"

export function DemoBanner() {
  const [on, setOn] = useState(false)
  useEffect(() => {
    fetch("/api/config")
      .then((response) => response.json())
      .then((data) => setOn(Boolean(data.demoMode)))
      .catch(() => setOn(false))
  }, [])
  if (!on) return null
  return (
    <p className="bg-ink py-2 text-center text-xs uppercase tracking-[0.14em] text-white">
      Demo mode, data resets
    </p>
  )
}
