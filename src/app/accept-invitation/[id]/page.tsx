'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { organizationAPI } from '@/lib/better-auth-client'
import { Button } from '@/ui-components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui-components/card'
import { Loader2, CheckCircle, XCircle, Mail } from 'lucide-react'
import { toast } from 'sonner'

interface InvitationDetails {
  id: string
  email: string
  role: string | string[]
  status: string
  expiresAt?: string
  organization: {
    id: string
    name: string
    description?: string
  }
  inviter: {
    user: {
      name?: string
      email: string
    }
  }
}

export default function AcceptInvitationPage() {
  const params = useParams()
  const router = useRouter()
  const invitationId = params?.id as string

  const [invitation, setInvitation] = useState<InvitationDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!invitationId) {
      setError('Invalid invitation link')
      setLoading(false)
      return
    }

    fetchInvitationDetails()
  }, [invitationId])

  async function fetchInvitationDetails() {
    try {
      setLoading(true)
      const result = await organizationAPI.getInvitation({
        query: { id: invitationId }
      })

      if (result.error) {
        setError(result.error.message || 'Failed to load invitation details')
        return
      }

      if (!result.data) {
        setError('Invitation not found')
        return
      }

      // Map the Better Auth invitation data to our interface
      const mappedInvitation: InvitationDetails = {
        id: result.data.id,
        email: result.data.email,
        role: result.data.role,
        status: result.data.status,
        expiresAt: result.data.expiresAt ? result.data.expiresAt.toString() : undefined,
        organization: {
          id: result.data.organizationId || 'unknown',
          name: 'Unknown Organization', // Better Auth may not include org details
          description: undefined
        },
        inviter: {
          user: {
            name: 'Unknown',
            email: 'unknown@example.com'
          }
        }
      }

      setInvitation(mappedInvitation)
    } catch (error: any) {
      console.error('Failed to fetch invitation details:', error)
      setError(error?.message || 'Failed to load invitation')
    } finally {
      setLoading(false)
    }
  }

  async function acceptInvitation() {
    if (!invitation) return

    try {
      setProcessing(true)
      const result = await organizationAPI.acceptInvitation({
        invitationId: invitation.id
      })

      if (result.error) {
        toast.error(result.error.message || 'Failed to accept invitation')
        return
      }

      toast.success(`Successfully joined ${invitation.organization.name}!`)
      
      // Redirect to organization or dashboard
      router.push('/dashboard') // Adjust the redirect path as needed
      
    } catch (error: any) {
      console.error('Failed to accept invitation:', error)
      toast.error(error?.message || 'Failed to accept invitation')
    } finally {
      setProcessing(false)
    }
  }

  async function rejectInvitation() {
    if (!invitation) return

    try {
      setProcessing(true)
      const result = await organizationAPI.rejectInvitation({
        invitationId: invitation.id
      })

      if (result.error) {
        toast.error(result.error.message || 'Failed to reject invitation')
        return
      }

      toast.success('Invitation rejected')
      
      // Redirect to home or login
      router.push('/') // Adjust the redirect path as needed
      
    } catch (error: any) {
      console.error('Failed to reject invitation:', error)
      toast.error(error?.message || 'Failed to reject invitation')
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-6">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
            <p className="text-gray-600">Loading invitation...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-red-900">Invalid Invitation</CardTitle>
            <CardDescription className="text-red-600">
              {error}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button 
              variant="outline" 
              onClick={() => router.push('/')}
              className="w-full"
            >
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <CardTitle>Invitation Not Found</CardTitle>
            <CardDescription>
              This invitation link may be expired or invalid.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button 
              variant="outline" 
              onClick={() => router.push('/')}
              className="w-full"
            >
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Check if invitation is expired
  const isExpired = invitation.expiresAt && new Date(invitation.expiresAt) < new Date()
  const isAlreadyProcessed = invitation.status !== 'pending'

  if (isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
            <CardTitle className="text-orange-900">Invitation Expired</CardTitle>
            <CardDescription className="text-orange-600">
              This invitation expired on {new Date(invitation.expiresAt!).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-4">
              Please contact the organization administrator for a new invitation.
            </p>
            <Button 
              variant="outline" 
              onClick={() => router.push('/')}
              className="w-full"
            >
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isAlreadyProcessed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <CardTitle className="text-green-900">Invitation Already Processed</CardTitle>
            <CardDescription className="text-green-600">
              This invitation has already been {invitation.status}.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button 
              variant="outline" 
              onClick={() => router.push('/dashboard')}
              className="w-full"
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Mail className="h-12 w-12 text-blue-500 mx-auto mb-4" />
          <CardTitle>You&apos;re Invited!</CardTitle>
          <CardDescription>
            Join {invitation.organization.name} and start collaborating
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Invitation Details */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-700">Organization</p>
              <p className="text-lg font-semibold">{invitation.organization.name}</p>
              {invitation.organization.description && (
                <p className="text-sm text-gray-600">{invitation.organization.description}</p>
              )}
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-700">Role</p>
              <p className="text-sm text-gray-900">
                {Array.isArray(invitation.role) ? invitation.role.join(', ') : invitation.role}
              </p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-700">Invited by</p>
              <p className="text-sm text-gray-900">
                {invitation.inviter.user.name || invitation.inviter.user.email}
              </p>
            </div>
            
            {invitation.expiresAt && (
              <div>
                <p className="text-sm font-medium text-gray-700">Expires</p>
                <p className="text-sm text-gray-900">
                  {new Date(invitation.expiresAt).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
          
          {/* Action Buttons */}
          <div className="space-y-3">
            <Button 
              onClick={acceptInvitation} 
              disabled={processing}
              className="w-full"
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Accept Invitation
                </>
              )}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={rejectInvitation} 
              disabled={processing}
              className="w-full"
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject Invitation
                </>
              )}
            </Button>
          </div>
          
          {/* Footer note */}
          <p className="text-xs text-gray-500 text-center">
            By accepting, you agree to join this organization and collaborate with the team.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}