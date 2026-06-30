"use client"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/ui-components/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui-components/tabs"
import { SignInTab } from "./_components/sign-in-tab"
import { SignUpTab } from "./_components/sign-up-tab"
import { EmailVerification } from "./_components/email-verification"
import { ForgotPassword } from "./_components/forgot-password"
import { useState } from "react"
import Image from "next/image"

type Tab = "signin" | "signup" | "email-verification" | "forgot-password"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [selectedTab, setSelectedTab] = useState<Tab>("signin")

  function openEmailVerificationTab(email: string) {
    setEmail(email)
    setSelectedTab("email-verification")
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <div className="flex flex-1 items-start justify-center px-10 pt-24 pb-12 lg:px-16">
        <div className="w-full max-w-sm">
          {(selectedTab === "signin" || selectedTab === "signup") && (
            <h1 className="text-3xl font-bold text-gray-900 mb-6">
              {selectedTab === "signup" ? "Something good is coming." : "Welcome back."}
            </h1>
          )}
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
                <CardContent className="pt-6">
                  <SignUpTab />
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

      <div className="hidden lg:flex relative w-[48%] m-4 rounded-2xl overflow-hidden flex-shrink-0">
        <Image
          src="/hero/login-bg.png"
          alt="MaticsApp — pixel-art Chicago winter street"
          fill
          className="object-cover object-center"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-6 right-6 text-right">
          <p className="text-white font-bold text-2xl leading-tight">MaticsApp</p>
          <p className="text-white/80 text-base">Built for the work that matters.</p>
        </div>
      </div>
    </div>
  )
}
