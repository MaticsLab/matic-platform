'use client'

import { useState } from 'react'
import { useSession, organizationAPI, signIn, signOut } from '@/lib/better-auth-client'
import { OrganizationManager } from '@/components/OrganizationManager'
import { Button } from '@/ui-components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui-components/card'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { toast } from 'sonner'

export default function TestOrgPage() {
  const { data: session, isPending } = useSession()
  const [testEmail, setTestEmail] = useState('')
  const [testing, setTesting] = useState(false)

  const testInvitation = async () => {
    if (!testEmail.trim()) {
      toast.error('Please enter an email address')
      return
    }

    if (!session) {
      toast.error('You must be signed in to send invitations')
      return
    }

    try {
      setTesting(true)
      
      // First create a test organization
      const orgResult = await organizationAPI.create({
        name: 'Test Organization',
        slug: 'test-org-' + Date.now(),
      })
      
      if (orgResult.error) {
        console.error('Org creation error:', orgResult.error)
        toast.error('Failed to create test organization: ' + orgResult.error.message)
        return
      }
      
      console.log('Created test org:', orgResult.data)
      
      // Then send invitation
      const inviteResult = await organizationAPI.inviteMember({
        email: testEmail,
        role: 'member' as const,
        organizationId: orgResult.data?.id || '',
      })
      
      if (inviteResult.error) {
        console.error('Invitation error:', inviteResult.error)
        toast.error('Failed to send invitation: ' + inviteResult.error.message)
        return
      }
      
      toast.success(`Invitation sent to ${testEmail}! Check server logs and email inbox.`)
      console.log('Invitation sent successfully:', inviteResult.data)
      
    } catch (error: any) {
      console.error('Test failed:', error)
      toast.error('Test failed: ' + error?.message)
    } finally {
      setTesting(false)
    }
  }

  if (isPending) {
    return (
      <div className="container mx-auto py-10">
        <Card>
          <CardContent className="flex items-center justify-center p-6">
            <p className="text-gray-500">Loading session...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="container mx-auto py-10">
        <Card>
          <CardHeader>
            <CardTitle>🔐 Authentication Required</CardTitle>
            <CardDescription>
              You need to sign in to test organization invitations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={() => signIn.email({ 
              email: 'test@example.com', 
              password: 'password123' 
            })}>
              Sign In with Email
            </Button>
            <Button variant="outline" onClick={() => signIn.social({ provider: 'google' })}>
              Sign In with Google
            </Button>
            <p className="text-sm text-gray-500">
              Or go to <a href="/login" className="text-blue-600 hover:underline">/login</a> to sign in with the full interface.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10 space-y-8">
      {/* Session Info */}
      <Card>
        <CardHeader>
          <CardTitle>👤 Current Session</CardTitle>
          <CardDescription>
            Signed in as: {session.user?.email || 'No email'} ({session.user?.name || 'No name'})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => signOut()}>
            Sign Out
          </Button>
        </CardContent>
      </Card>

      {/* Quick Email Test */}
      <Card>
        <CardHeader>
          <CardTitle>🧪 Test Organization Invitation Email</CardTitle>
          <CardDescription>
            Test the Resend email functionality by creating a test organization and sending an invitation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="test-email">Test Email Address</Label>
            <Input
              id="test-email"
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="Enter email to test invitation"
            />
          </div>
          <Button onClick={testInvitation} disabled={testing}>
            {testing ? 'Testing...' : 'Send Test Invitation'}
          </Button>
          <div className="text-sm text-gray-500">
            <p>This will:</p>
            <ul className="list-disc list-inside ml-4">
              <li>Create a test organization</li>
              <li>Send an invitation email to the provided address</li>
              <li>Show success/error messages</li>
              <li>Log details to the console</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Full Organization Manager */}
      <Card>
        <CardHeader>
          <CardTitle>📋 Full Organization Management</CardTitle>
          <CardDescription>
            Complete organization management interface with invitation system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrganizationManager />
        </CardContent>
      </Card>
    </div>
  )
}