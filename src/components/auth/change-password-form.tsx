"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/ui-components/form"
import { Input } from "@/ui-components/input"
import { Button } from "@/ui-components/button"
import { Checkbox } from "@/ui-components/checkbox"
import { LoadingSwap } from "@/components/ui/loading-swap"
import { authClient, changePassword } from "@/auth/client/main"
import { toast } from "sonner"

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
    revokeOtherSessions: z.boolean(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

type ChangePasswordForm = z.infer<typeof changePasswordSchema>

export function ChangePasswordForm({ email }: { email: string }) {
  const [hasPassword, setHasPassword] = useState<boolean | null>(null)
  const [sendingReset, setSendingReset] = useState(false)

  useEffect(() => {
    authClient
      .listAccounts()
      .then((res) => {
        const accounts = res?.data ?? []
        setHasPassword(accounts.some((a: any) => a.providerId === "credential"))
      })
      .catch(() => setHasPassword(true)) // fail open to the normal form rather than block the user
  }, [])

  const form = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
      revokeOtherSessions: true,
    },
  })

  const { isSubmitting } = form.formState

  async function handleSubmit(data: ChangePasswordForm) {
    const result = await changePassword({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
      revokeOtherSessions: data.revokeOtherSessions,
    })
    if (result.error) {
      toast.error(result.error.message || "Failed to change password")
      return
    }
    toast.success("Password changed successfully")
    form.reset()
  }

  async function handleSendResetEmail() {
    setSendingReset(true)
    try {
      const response = await fetch("/api/auth/forget-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          redirectTo: `${window.location.origin}/auth/reset-password`,
        }),
      })
      if (!response.ok) throw new Error("Failed to send reset email")
      toast.success("Password setup email sent! Check your inbox.")
    } catch (error: any) {
      toast.error(error.message || "Failed to send reset email")
    } finally {
      setSendingReset(false)
    }
  }

  if (hasPassword === null) return null

  if (!hasPassword) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Your account signs in via a connected provider and has no password yet. We'll email you a
          link to set one.
        </p>
        <Button onClick={handleSendResetEmail} disabled={sendingReset}>
          <LoadingSwap isLoading={sendingReset}>Send Setup Email</LoadingSwap>
        </Button>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
        <FormField
          control={form.control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Current Password</FormLabel>
              <FormControl>
                <Input type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="newPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New Password</FormLabel>
              <FormControl>
                <Input type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm New Password</FormLabel>
              <FormControl>
                <Input type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="revokeOtherSessions"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <FormLabel className="!mt-0">Log out other sessions</FormLabel>
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting}>
          <LoadingSwap isLoading={isSubmitting}>Change Password</LoadingSwap>
        </Button>
      </form>
    </Form>
  )
}
