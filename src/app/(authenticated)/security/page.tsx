'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui-components/tabs'
import { SessionManagement } from '@/components/SessionManagement'
import { ChangePassword } from '@/components/ChangePassword'
import { Shield, Key, Laptop } from 'lucide-react'

export default function SecuritySettingsPage() {
  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-8 w-8" />
          Security Settings
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage your account security, active sessions, and password
        </p>
      </div>

      <Tabs defaultValue="sessions" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="sessions" className="flex items-center gap-2">
            <Laptop className="h-4 w-4" />
            Active Sessions
          </TabsTrigger>
          <TabsTrigger value="password" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Change Password
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="space-y-4">
          <SessionManagement />
        </TabsContent>

        <TabsContent value="password" className="space-y-4">
          <ChangePassword />
        </TabsContent>
      </Tabs>
    </div>
  )
}
