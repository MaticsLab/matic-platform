'use client'

import { useState, useEffect } from 'react'
import { useSession, authClient } from '@/lib/better-auth-client'
import { Button } from '@/ui-components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/ui-components/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/ui-components/alert-dialog'
import { Badge } from '@/ui-components/badge'
import { Laptop, Smartphone, Tablet, Monitor, Trash2, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

interface DeviceSession {
  id: string
  token: string
  userAgent: string
  ipAddress: string | null
  createdAt: Date
  expiresAt: Date
  isCurrent: boolean
}

function getDeviceIcon(userAgent: string) {
  const ua = userAgent.toLowerCase()
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return <Smartphone className="h-5 w-5" />
  }
  if (ua.includes('tablet') || ua.includes('ipad')) {
    return <Tablet className="h-5 w-5" />
  }
  if (ua.includes('mac') || ua.includes('macintosh')) {
    return <Monitor className="h-5 w-5" />
  }
  return <Laptop className="h-5 w-5" />
}

function getDeviceName(userAgent: string): string {
  const ua = userAgent.toLowerCase()
  
  // Operating System
  let os = 'Unknown OS'
  if (ua.includes('windows')) os = 'Windows'
  else if (ua.includes('mac os x') || ua.includes('macintosh')) os = 'macOS'
  else if (ua.includes('linux')) os = 'Linux'
  else if (ua.includes('android')) os = 'Android'
  else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS'
  
  // Browser
  let browser = 'Unknown Browser'
  if (ua.includes('edg/')) browser = 'Edge'
  else if (ua.includes('chrome') && !ua.includes('edg')) browser = 'Chrome'
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari'
  else if (ua.includes('firefox')) browser = 'Firefox'
  
  return `${os} · ${browser}`
}

function getLocation(ipAddress: string | null): string {
  // In a real app, you'd use IP geolocation
  if (!ipAddress) return 'Unknown location'
  if (ipAddress.startsWith('127.') || ipAddress === '::1') return 'Local device'
  return 'Unknown location'
}

export function SessionManagement() {
  const { data: session } = useSession()
  const [sessions, setSessions] = useState<DeviceSession[]>([])
  const [loading, setLoading] = useState(true)
  const [sessionToRevoke, setSessionToRevoke] = useState<DeviceSession | null>(null)
  const [revoking, setRevoking] = useState(false)

  useEffect(() => {
    loadSessions()
  }, [])

  async function loadSessions() {
    try {
      setLoading(true)
      const response = await authClient.listSessions()
      
      if (response.data) {
        const currentToken = session?.session?.token
        const deviceSessions: DeviceSession[] = response.data.map((s: any) => ({
          id: s.id,
          token: s.token,
          userAgent: s.userAgent || 'Unknown device',
          ipAddress: s.ipAddress,
          createdAt: new Date(s.createdAt),
          expiresAt: new Date(s.expiresAt),
          isCurrent: s.token === currentToken,
        }))
        setSessions(deviceSessions)
      }
    } catch (error) {
      console.error('Failed to load sessions:', error)
      toast.error('Failed to load active sessions')
    } finally {
      setLoading(false)
    }
  }

  async function revokeSession(sessionToRevoke: DeviceSession) {
    try {
      setRevoking(true)
      await authClient.revokeSession({ token: sessionToRevoke.token })
      
      toast.success(
        sessionToRevoke.isCurrent 
          ? 'Current session revoked. You will be logged out.' 
          : 'Session revoked successfully'
      )
      
      // Reload sessions
      await loadSessions()
      
      // If current session was revoked, redirect to login
      if (sessionToRevoke.isCurrent) {
        setTimeout(() => {
          window.location.href = '/login'
        }, 1500)
      }
    } catch (error) {
      console.error('Failed to revoke session:', error)
      toast.error('Failed to revoke session')
    } finally {
      setRevoking(false)
      setSessionToRevoke(null)
    }
  }

  async function revokeOtherSessions() {
    try {
      setRevoking(true)
      await authClient.revokeOtherSessions()
      toast.success('All other sessions revoked successfully')
      await loadSessions()
    } catch (error) {
      console.error('Failed to revoke other sessions:', error)
      toast.error('Failed to revoke other sessions')
    } finally {
      setRevoking(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Active Sessions</CardTitle>
          <CardDescription>Loading your active sessions...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Active Sessions</CardTitle>
              <CardDescription>
                Manage your active sessions across all devices. You have {sessions.length} active {sessions.length === 1 ? 'session' : 'sessions'}.
              </CardDescription>
            </div>
            {sessions.length > 1 && (
              <Button 
                variant="outline" 
                onClick={revokeOtherSessions}
                disabled={revoking}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Revoke All Others
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sessions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No active sessions found
              </p>
            )}
            
            {sessions.map((deviceSession) => (
              <div
                key={deviceSession.id}
                className={`flex items-start gap-4 p-4 rounded-lg border ${
                  deviceSession.isCurrent 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border'
                }`}
              >
                <div className="mt-1 text-muted-foreground">
                  {getDeviceIcon(deviceSession.userAgent)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm">
                      {getDeviceName(deviceSession.userAgent)}
                    </p>
                    {deviceSession.isCurrent && (
                      <Badge variant="default" className="text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Current
                      </Badge>
                    )}
                  </div>
                  
                  <p className="text-xs text-muted-foreground mb-1">
                    {getLocation(deviceSession.ipAddress)}
                  </p>
                  
                  <p className="text-xs text-muted-foreground">
                    Signed in {deviceSession.createdAt.toLocaleDateString()} at{' '}
                    {deviceSession.createdAt.toLocaleTimeString()}
                  </p>
                  
                  <p className="text-xs text-muted-foreground">
                    Expires {deviceSession.expiresAt.toLocaleDateString()}
                  </p>
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSessionToRevoke(deviceSession)}
                  disabled={revoking}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!sessionToRevoke} onOpenChange={() => setSessionToRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Session</AlertDialogTitle>
            <AlertDialogDescription>
              {sessionToRevoke?.isCurrent ? (
                <>
                  You are about to revoke your <strong>current session</strong>. 
                  You will be logged out and need to sign in again.
                </>
              ) : (
                <>
                  Are you sure you want to revoke this session? The device will be 
                  logged out and need to sign in again.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => sessionToRevoke && revokeSession(sessionToRevoke)}
              disabled={revoking}
              className="bg-destructive hover:bg-destructive/90"
            >
              {revoking ? 'Revoking...' : 'Revoke Session'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
