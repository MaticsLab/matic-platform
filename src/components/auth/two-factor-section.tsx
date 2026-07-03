"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { Badge } from "@/ui-components/badge"
import { Button } from "@/ui-components/button"
import { Input } from "@/ui-components/input"
import { Label } from "@/ui-components/label"
import { LoadingSwap } from "@/components/ui/loading-swap"
import { BetterAuthActionButton } from "@/components/auth/better-auth-action-button"
import { twoFactorAPI } from "@/auth/client/main"
import { toast } from "sonner"

type Step = "idle" | "password" | "qr" | "backup-codes"

export function TwoFactorSection({ isEnabled }: { isEnabled: boolean }) {
  const [step, setStep] = useState<Step>("idle")
  const [password, setPassword] = useState("")
  const [totpUri, setTotpUri] = useState<string | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [code, setCode] = useState("")
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (totpUri) {
      QRCode.toDataURL(totpUri).then(setQrDataUrl).catch(() => setQrDataUrl(null))
    }
  }, [totpUri])

  async function handleStartEnable() {
    setSubmitting(true)
    try {
      const result = await twoFactorAPI.enable({ password })
      if (result.error) {
        toast.error(result.error.message || "Failed to start 2FA enrollment")
        return
      }
      setTotpUri(result.data?.totpURI ?? null)
      setStep("qr")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleVerifyCode() {
    setSubmitting(true)
    try {
      const result = await twoFactorAPI.verifyTotp({ code })
      if (result.error) {
        toast.error(result.error.message || "Invalid code")
        return
      }
      const backupResult = await twoFactorAPI.generateBackupCodes({ password })
      if (backupResult.error) {
        toast.error(backupResult.error.message || "Failed to generate backup codes")
        return
      }
      setBackupCodes(backupResult.data?.backupCodes ?? [])
      setStep("backup-codes")
      toast.success("Two-factor authentication enabled")
    } finally {
      setSubmitting(false)
    }
  }

  function handleFinish() {
    setStep("idle")
    setPassword("")
    setTotpUri(null)
    setQrDataUrl(null)
    setCode("")
    setBackupCodes(null)
    window.location.reload()
  }

  if (isEnabled) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge>Enabled</Badge>
        </div>
        <div className="space-y-2">
          <Label>Enter your password to disable two-factor authentication</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <BetterAuthActionButton
          variant="destructive"
          requireAreYouSure
          areYouSureDescription="This will remove two-factor authentication from your account."
          successMessage="Two-factor authentication disabled"
          action={() => twoFactorAPI.disable({ password })}
        >
          Disable Two-Factor Authentication
        </BetterAuthActionButton>
      </div>
    )
  }

  if (step === "idle") {
    return (
      <Button variant="outline" onClick={() => setStep("password")}>
        Enable Two-Factor Authentication
      </Button>
    )
  }

  if (step === "password") {
    return (
      <div className="space-y-3">
        <Label>Confirm your password to continue</Label>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStep("idle")}>
            Cancel
          </Button>
          <Button onClick={handleStartEnable} disabled={submitting || !password}>
            <LoadingSwap isLoading={submitting}>Continue</LoadingSwap>
          </Button>
        </div>
      </div>
    )
  }

  if (step === "qr") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Scan this QR code with your authenticator app.</p>
        {qrDataUrl && <img src={qrDataUrl} alt="Two-factor QR code" className="h-48 w-48" />}
        <Label>Enter the 6-digit code from your app</Label>
        <Input value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} />
        <Button onClick={handleVerifyCode} disabled={submitting || code.length < 6}>
          <LoadingSwap isLoading={submitting}>Verify</LoadingSwap>
        </Button>
      </div>
    )
  }

  // step === "backup-codes"
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Save these backup codes somewhere safe. Each can be used once if you lose access to your
        authenticator app. They won't be shown again.
      </p>
      <div className="grid grid-cols-2 gap-2 rounded-md border p-3 font-mono text-sm">
        {backupCodes?.map((c) => <div key={c}>{c}</div>)}
      </div>
      <Button onClick={handleFinish}>Done</Button>
    </div>
  )
}
