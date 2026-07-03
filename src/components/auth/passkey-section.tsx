"use client"

import { useState } from "react"
import { Button } from "@/ui-components/button"
import { Input } from "@/ui-components/input"
import { LoadingSwap } from "@/components/ui/loading-swap"
import { BetterAuthActionButton } from "@/components/auth/better-auth-action-button"
import { passkeyAPI } from "@/auth/client/main"
import { KeyRound, Trash2 } from "lucide-react"
import { toast } from "sonner"

export function PasskeySection() {
  const { data: passkeys, refetch } = passkeyAPI.useListPasskeys()
  const [name, setName] = useState("")
  const [adding, setAdding] = useState(false)

  async function handleAddPasskey() {
    setAdding(true)
    try {
      const result = await passkeyAPI.addPasskey({ name: name || undefined })
      if (result?.error) {
        toast.error(result.error.message || "Failed to add passkey")
        return
      }
      toast.success("Passkey added")
      setName("")
      refetch?.()
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Passkey name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button onClick={handleAddPasskey} disabled={adding}>
          <LoadingSwap isLoading={adding}>Add Passkey</LoadingSwap>
        </Button>
      </div>

      {!passkeys || passkeys.length === 0 ? (
        <p className="text-sm text-muted-foreground">No passkeys registered yet.</p>
      ) : (
        <div className="space-y-2">
          {passkeys.map((passkey: any) => (
            <div key={passkey.id} className="flex items-center justify-between rounded-md border p-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{passkey.name || "Unnamed passkey"}</span>
              </div>
              <BetterAuthActionButton
                variant="ghost"
                size="sm"
                requireAreYouSure
                successMessage="Passkey removed"
                action={async () => {
                  const result = await passkeyAPI.deletePasskey({ id: passkey.id })
                  refetch?.()
                  return result
                }}
              >
                <Trash2 className="h-4 w-4" />
              </BetterAuthActionButton>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
