"use client"

import { ActionButton } from "@/components/ui/action-button"
import type { ComponentProps } from "react"

type BetterAuthResult = { error: { message?: string } | null }

type BetterAuthActionButtonProps = Omit<ComponentProps<typeof ActionButton>, "action"> & {
  action: () => Promise<BetterAuthResult>
  successMessage?: string
}

export function BetterAuthActionButton({ action, successMessage, ...props }: BetterAuthActionButtonProps) {
  return (
    <ActionButton
      action={async () => {
        const result = await action()
        return {
          error: result.error != null,
          message: result.error?.message,
        }
      }}
      successMessage={successMessage}
      {...props}
    />
  )
}
