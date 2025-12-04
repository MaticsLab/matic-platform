"use client"

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { invitationsClient } from '@/lib/api/invitations-client'
import { Button } from '@/ui-components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/ui-components/card'
import { Loader2, CheckCircle2, XCircle, Building2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import type { InvitationPreview } from '@/types/workspaces'

export default function InvitePage() {
  const params = useParams()
  const router = useRouter()
  const token = params?.token as string

  const [isLoading, setIsLoading] = useState(true)
  const [invitation, setInvitation] = useState<InvitationPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isAccepting, setIsAccepting] = useState(false)
  const [isDeclining, setIsDeclining] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user) {
        setIsAuthenticated(true)
        setUserEmail(session.user.email || null)
      }
    }
    checkAuth()
  }, [])

  // Load invitation details
  const loadInvitation = useCallback(async () => {
    if (!token) {
      setError('Invalid invitation link')
      setIsLoading(false)
      return
    }

    try {
      const data = await invitationsClient.getByToken(token)
      setInvitation(data)
      
      if (data.is_expired) {
        setError('This invitation has expired')
      }
    } catch (err: any) {
      console.error('Failed to load invitation:', err)
      setError(err.message || 'Invitation not found or has already been used')
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadInvitation()
  }, [loadInvitation])

  const handleAccept = async () => {
    if (!isAuthenticated) {
      // Redirect to login with a return URL
      const returnUrl = `/invite/${token}`
      router.push(`/login?redirect=${encodeURIComponent(returnUrl)}`)
      return
    }

    setIsAccepting(true)
    try {
      const result = await invitationsClient.accept(token)
      toast.success(`Welcome to ${result.workspace.name}!`)
      
      // Redirect to the workspace
      router.push(`/workspace/${result.workspace.slug}`)
    } catch (err: any) {
      console.error('Failed to accept invitation:', err)
      toast.error(err.message || 'Failed to accept invitation')
    } finally {
      setIsAccepting(false)
    }
  }

  const handleDecline = async () => {
    setIsDeclining(true)
    try {
      // Call the decline endpoint
      const response = await fetch(`/api/v1/invitations/decline/${token}`, {
        method: 'POST',
      })
      
      if (!response.ok) {
        throw new Error('Failed to decline invitation')
      }
      
      toast.success('Invitation declined')
      router.push('/')
    } catch (err: any) {
      console.error('Failed to decline invitation:', err)
      toast.error(err.message || 'Failed to decline invitation')
    } finally {
      setIsDeclining(false)
    }
  }

  const handleLoginRedirect = () => {
    const returnUrl = `/invite/${token}`
    router.push(`/login?redirect=${encodeURIComponent(returnUrl)}`)
  }

  const handleSignupRedirect = () => {
    const returnUrl = `/invite/${token}`
    router.push(`/signup?redirect=${encodeURIComponent(returnUrl)}&email=${encodeURIComponent(invitation?.invitation.email || '')}`)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-gray-500">Loading invitation...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <CardTitle>Invitation Error</CardTitle>
            <CardDescription className="text-red-600">{error}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button variant="outline" onClick={() => router.push('/')}>
              Return Home
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
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-6 h-6 text-gray-600" />
            </div>
            <CardTitle>Invitation Not Found</CardTitle>
            <CardDescription>
              This invitation may have expired or already been used.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button variant="outline" onClick={() => router.push('/')}>
              Return Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-6 h-6 text-blue-600" />
          </div>
          <CardTitle>Workspace Invitation</CardTitle>
          <CardDescription>
            You've been invited to join{' '}
            <span className="font-semibold text-gray-900">
              {invitation.workspace.name}
            </span>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Invitation Details */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Invited as</span>
              <span className="font-medium capitalize">{invitation.invitation.role}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Email</span>
              <span className="font-medium">{invitation.invitation.email}</span>
            </div>
          </div>

          {/* Authentication Status */}
          {!isAuthenticated ? (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                <p>Please sign in or create an account to accept this invitation.</p>
              </div>
              <div className="flex flex-col gap-3">
                <Button onClick={handleLoginRedirect} className="w-full">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Sign In to Accept
                </Button>
                <Button variant="outline" onClick={handleSignupRedirect} className="w-full">
                  Create an Account
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {userEmail && userEmail !== invitation.invitation.email && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                  <p>
                    You're signed in as <strong>{userEmail}</strong>, but this invitation
                    was sent to <strong>{invitation.invitation.email}</strong>.
                  </p>
                  <p className="mt-2">
                    You can still accept, but we recommend using the invited email.
                  </p>
                </div>
              )}
              
              <div className="flex flex-col gap-3">
                <Button 
                  onClick={handleAccept} 
                  disabled={isAccepting}
                  className="w-full"
                >
                  {isAccepting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Accepting...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Accept Invitation
                    </>
                  )}
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={handleDecline}
                  disabled={isDeclining}
                  className="w-full text-gray-500 hover:text-red-600"
                >
                  {isDeclining ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Declining...
                    </>
                  ) : (
                    'Decline Invitation'
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
