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
import { PasswordInput } from "@/ui-components/password-input"
import { Button } from "@/ui-components/button"
import { authClient } from "@/lib/auth/auth-client"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"

const signInSchema = z.object({
  email: z.string().email("Please enter a valid email").min(1),
  password: z.string().optional().or(z.literal('')).refine(
    val => !val || val.length >= 6,
    { message: 'Password must be at least 6 characters' }
  ),
})

type SignInForm = z.infer<typeof signInSchema>

export function SignInTab({
  openEmailVerificationTab,
  openForgotPassword,
}: {
  openEmailVerificationTab: (email: string) => void
  openForgotPassword: () => void
}) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const form = useForm<SignInForm>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const passwordValue = form.watch('password')
  const buttonText = useMemo(() => {
    if (passwordValue && passwordValue.length > 0) {
      return 'Log In';
    }
    return 'Email me a login link';
  }, [passwordValue])

  async function handleSignIn(data: SignInForm) {
    setIsSubmitting(true)
    try {
      if (data.password && data.password.length > 0) {
        // Password login
        await authClient.signIn.email(
          { email: data.email, password: data.password, callbackURL: "/login" },
          {
            onError: error => {
              if (error.error.code === "EMAIL_NOT_VERIFIED") {
                openEmailVerificationTab(data.email)
              }
              toast.error(error.error.message || "Failed to sign in")
            },
            onSuccess: (data) => {
              // Redirect to /login which handles proper routing based on user type
              console.log('[Sign-in] Login successful, redirecting to /login', data)
              router.push("/login")
            },
          }
        )
      } else {
        // Magic link login
        await authClient.signIn.magicLink(
          { email: data.email, callbackURL: "/login" },
          {
            onError: error => {
              toast.error(error.error.message || "Failed to send magic link")
            },
            onSuccess: () => {
              toast.success("Check your email for a login link!")
            },
          }
        )
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(handleSignIn)}>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email webauthn"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex justify-between items-center">
                  <FormLabel>Password</FormLabel>
                  <Button
                    onClick={openForgotPassword}
                    type="button"
                    variant="link"
                    size="sm"
                    className="text-sm font-normal underline"
                  >
                    Forgot password?
                  </Button>
                </div>
                <FormControl>
                  <PasswordInput
                    autoComplete="current-password webauthn"
                    placeholder="Optional"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Loading..." : buttonText}
            {!isSubmitting && <span className="ml-2" aria-hidden="true">→</span>}
          </Button>
        </form>
      </Form>
    </div>
  )
}
