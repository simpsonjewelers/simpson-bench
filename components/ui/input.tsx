import * as React from "react"
import { cn } from "@/lib/utils"

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-12 w-full border border-line bg-white px-3 text-base outline-none focus:border-ink",
        className,
      )}
      {...props}
    />
  )
}
