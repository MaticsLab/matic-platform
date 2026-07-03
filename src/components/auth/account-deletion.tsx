"use client"

import { BetterAuthActionButton } from "@/components/auth/better-auth-action-button"
import { deleteUser } from "@/auth/client/main"

export function AccountDeletion() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Permanently delete your account. We'll email you a confirmation link — your account is not
        deleted until you click it.
      </p>
      <BetterAuthActionButton
        variant="destructive"
        requireAreYouSure
        areYouSureTitle="Delete your account?"
        areYouSureDescription="We'll send a confirmation link to your email. Your account won't be deleted until you click it."
        successMessage="Check your email to confirm account deletion"
        action={() => deleteUser({ callbackURL: "/" })}
      >
        Delete Account
      </BetterAuthActionButton>
    </div>
  )
}
