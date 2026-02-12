"use client"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/ui-components/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui-components/tabs"
import { SignInTab } from "./_components/sign-in-tab"
import { EmailVerification } from "./_components/email-verification"
import { ForgotPassword } from "./_components/forgot-password"
import { useState } from "react"

type Tab = "signin" | "signup" | "email-verification" | "forgot-password"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [selectedTab, setSelectedTab] = useState<Tab>("signin")

  // Don't check session on mount - this is the login page
  // After successful login, sign-in-tab.tsx handles the redirect to /login
  // which then redirects to the appropriate workspace/portal

  function openEmailVerificationTab(email: string) {
    setEmail(email)
    setSelectedTab("email-verification")
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-md px-4">
        <Tabs
          value={selectedTab}
          onValueChange={t => setSelectedTab(t as Tab)}
          className="w-full"
        >
          {(selectedTab === "signin" || selectedTab === "signup") && (
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
          )}
          
          <TabsContent value="signin">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl font-bold">Sign In</CardTitle>
              </CardHeader>
              <CardContent>
                <SignInTab
                  openEmailVerificationTab={openEmailVerificationTab}
                  openForgotPassword={() => setSelectedTab("forgot-password")}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="signup">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl font-bold">Sign Up</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center text-muted-foreground">
                  Sign up coming soon
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="email-verification">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl font-bold">Verify Your Email</CardTitle>
              </CardHeader>
              <CardContent>
                <EmailVerification email={email} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="forgot-password">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl font-bold">Forgot Password</CardTitle>
              </CardHeader>
              <CardContent>
                <ForgotPassword onBack={() => setSelectedTab("signin")} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
