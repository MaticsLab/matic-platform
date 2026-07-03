"use client"

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
import { LoadingSwap } from "@/components/ui/loading-swap"
import { authClient, changeEmail } from "@/auth/client/main"
import { toast } from "sonner"

const profileUpdateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Please enter a valid email"),
})

type ProfileUpdateForm = z.infer<typeof profileUpdateSchema>

export function ProfileUpdateForm({ user }: { user: { name: string; email: string } }) {
  const form = useForm<ProfileUpdateForm>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: user,
  })

  const { isSubmitting } = form.formState

  async function handleSubmit(data: ProfileUpdateForm) {
    const updateResult = await authClient.updateUser({ name: data.name })
    if (updateResult.error) {
      toast.error(updateResult.error.message || "Failed to update profile")
      return
    }

    if (data.email !== user.email) {
      const emailResult = await changeEmail({
        newEmail: data.email,
        callbackURL: "/",
      })
      if (emailResult.error) {
        toast.error(emailResult.error.message || "Failed to change email")
        return
      }
      toast.success("Check your current email to confirm the change.")
      return
    }

    toast.success("Profile updated successfully")
  }

  return (
    <Form {...form}>
      <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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

        <Button type="submit" disabled={isSubmitting}>
          <LoadingSwap isLoading={isSubmitting}>Update Profile</LoadingSwap>
        </Button>
      </form>
    </Form>
  )
}
