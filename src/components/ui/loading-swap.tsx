"use client"

import { cn } from "@/lib/utils"
import { Spinner } from "@/ui-components/spinner"

export function LoadingSwap({
  isLoading,
  children,
  className,
}: {
  isLoading: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("grid items-center justify-items-center", className)}>
      <div className={cn("col-start-1 row-start-1", isLoading ? "invisible" : "visible")}>
        {children}
      </div>
      <div className={cn("col-start-1 row-start-1", isLoading ? "visible" : "invisible")}>
        <Spinner />
      </div>
    </div>
  )
}
