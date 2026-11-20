"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { CustomerFrame } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  return (
    <CustomerFrame>
      <h1 className="serif text-4xl">Staff sign in</h1>
      <p className="mt-2 text-sm text-muted">The bench is private. Customers do not use this page. Repair status stays open without a password.</p>
      <form
        className="mt-6 space-y-3"
        onSubmit={async (event) => {
          event.preventDefault()
          setError("")
          const response = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
          })
          const data = await response.json()
          if (!response.ok) {
            setError(data.error || "Could not sign in")
            return
          }
          const next = params.get("next")
          router.push(next && next.startsWith("/") ? next : "/")
          router.refresh()
        }}
      >
        <label>
          <Label>Password</Label>
          <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
        </label>
        <Button type="submit">Sign in</Button>
      </form>
      {error && <p className="mt-4 text-sm text-danger">{error}</p>}
    </CustomerFrame>
  )
}
