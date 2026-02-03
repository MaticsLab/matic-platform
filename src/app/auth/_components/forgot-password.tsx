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
      await authClient.resetPassword(
        {
          email: data.email,
          redirectTo: "/auth/reset-password",
        },
        {
          onError: error => {
            toast.error(
              error.error.message || "Failed to send password reset email"
            )
          },
          onSuccess: () => {
            toast.success("Password reset email sent! Check your inbox.")
          },
        }
      )
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
