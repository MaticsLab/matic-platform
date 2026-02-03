"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import z from "zod"
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
import { authClient } from "@/lib/auth/auth-client"
import { toast } from "sonner"
import { useState } from "react"

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email").min(1),
})

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>

export function ForgotPassword({
  onBack,
}: {
  onBack: () => void
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const form = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  })

  async function handleForgotPassword(data: ForgotPasswordForm) {
    setIsSubmitting(true)
    try {
      // Call Better Auth forget-password endpoint directly
      const response = await fetch('/api/auth/forget-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          redirectTo: "/auth/reset-password",
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send password reset email')
      }

      toast.success("Password reset email sent! Check your inbox.")
      form.reset()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send password reset email")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit(handleForgotPassword)}
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting ? "Sending..." : "Send Reset Email"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
