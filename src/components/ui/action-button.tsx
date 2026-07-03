"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { Button, type ButtonProps } from "@/ui-components/button"
import { LoadingSwap } from "./loading-swap"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/ui-components/alert-dialog"

type ActionButtonProps = Omit<ButtonProps, "onClick"> & {
  action: () => Promise<{ error: boolean; message?: string }>
  requireAreYouSure?: boolean
  areYouSureTitle?: string
  areYouSureDescription?: string
  successMessage?: string
}

export function ActionButton({
  action,
  requireAreYouSure = false,
  areYouSureTitle = "Are you sure?",
  areYouSureDescription = "This action cannot be undone.",
  successMessage,
  children,
  disabled,
  ...buttonProps
}: ActionButtonProps) {
  const [isPending, startTransition] = useTransition()

  function performAction() {
    startTransition(async () => {
      const result = await action()
      if (result.error) {
        toast.error(result.message || "Something went wrong")
      } else {
        toast.success(result.message || successMessage || "Success")
      }
    })
  }

  if (requireAreYouSure) {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button disabled={disabled || isPending} {...buttonProps}>
            <LoadingSwap isLoading={isPending}>{children}</LoadingSwap>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{areYouSureTitle}</AlertDialogTitle>
            <AlertDialogDescription>{areYouSureDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={performAction}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }

  return (
    <Button disabled={disabled || isPending} onClick={performAction} {...buttonProps}>
      <LoadingSwap isLoading={isPending}>{children}</LoadingSwap>
    </Button>
  )
}
