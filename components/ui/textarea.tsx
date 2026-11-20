import * as React from "react"
import { cn } from "@/lib/utils"

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn("min-h-28 w-full border border-line bg-white px-3 py-3 text-base outline-none focus:border-ink", className)}
      {...props}
    />
  )
}
