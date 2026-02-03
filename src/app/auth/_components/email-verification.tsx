"use client"

import { authClient } from "@/lib/auth/auth-client"
import { Button } from "@/ui-components/button"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

export function EmailVerification({ email }: { email: string }) {
  const [timeToNextResend, setTimeToNextResend] = useState(30)
  const [isSending, setIsSending] = useState(false)
  const interval = useRef<NodeJS.Timeout | undefined>(undefined)

  useEffect(() => {
    startEmailVerificationCountdown()
    return () => {
      if (interval.current) clearInterval(interval.current)
    }
  }, [])

  function startEmailVerificationCountdown(time = 30) {
    setTimeToNextResend(time)

    if (interval.current) clearInterval(interval.current)
    interval.current = setInterval(() => {
      setTimeToNextResend(t => {
        const newT = t - 1

        if (newT <= 0) {
          if (interval.current) clearInterval(interval.current)
          return 0
        }
        return newT
      })
    }, 1000)
  }

  async function handleResendEmail() {
    setIsSending(true)
    try {
      await authClient.sendVerificationEmail({
        email,
        callbackURL: "/",
      })
      toast.success("Verification email sent!")
      startEmailVerificationCountdown()
    } catch (error) {
      toast.error("Failed to send verification email")
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground mt-2">
        We sent you a verification link. Please check your email and click the
        link to verify your account.
      </p>

      <Button
        variant="outline"
        className="w-full"
        disabled={timeToNextResend > 0 || isSending}
        onClick={handleResendEmail}
      >
        {isSending
          ? "Sending..."
          : timeToNextResend > 0
          ? `Resend Email (${timeToNextResend})`
          : "Resend Email"}
      </Button>
    </div>
  )
}
