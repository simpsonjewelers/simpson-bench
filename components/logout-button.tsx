"use client"

import { useRouter } from "next/navigation"

export function LogoutButton() {
  const router = useRouter()
  return (
    <button
      type="button"
      className="shrink-0 text-xs uppercase tracking-[0.16em] text-muted"
      onClick={async () => {
        await fetch("/api/login", { method: "DELETE" })
        router.push("/login")
        router.refresh()
      }}
    >
      Log out
    </button>
  )
}
