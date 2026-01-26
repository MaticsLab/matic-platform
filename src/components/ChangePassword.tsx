'use client'

import { useState } from 'react'
import { authClient } from '@/lib/better-auth-client'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/ui-components/card'
import { Alert, AlertDescription } from '@/ui-components/alert'
import { Checkbox } from '@/ui-components/checkbox'
import { Eye, EyeOff, Lock, Shield, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

export function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(true)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Password strength validation
  const getPasswordStrength = (password: string) => {
    let strength = 0
    if (password.length >= 8) strength++
    if (password.length >= 12) strength++
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++
    if (/\d/.test(password)) strength++
    if (/[^a-zA-Z0-9]/.test(password)) strength++
    return strength
  }

  const passwordStrength = getPasswordStrength(newPassword)
  const passwordStrengthLabel = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'][passwordStrength] || 'Very Weak'
  const passwordStrengthColor = ['red', 'orange', 'yellow', 'lightgreen', 'green'][passwordStrength] || 'red'

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All fields are required')
      return
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }

    if (currentPassword === newPassword) {
      setError('New password must be different from current password')
      return
    }

    try {
      setLoading(true)

      // Better Auth: Change password with optional session revocation
      await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions, // Revoke all other sessions if enabled
      })

      toast.success(
        revokeOtherSessions
          ? 'Password changed successfully. All other sessions have been logged out.'
          : 'Password changed successfully'
      )

      // Clear form
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setError('')

      // If revoked other sessions, show notification
      if (revokeOtherSessions) {
        toast.info('You remain logged in on this device', {
          duration: 5000,
        })
      }
    } catch (err: any) {
      console.error('Password change error:', err)
      setError(
        err.message || 
        err.error?.message || 
        'Failed to change password. Please check your current password and try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Change Password
        </CardTitle>
        <CardDescription>
          Update your password to keep your account secure. We recommend using a strong, unique password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleChangePassword} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Current Password */}
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current Password</Label>
            <div className="relative">
              <Input
                id="currentPassword"
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter your current password"
                disabled={loading}
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                {showCurrentPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter your new password"
                disabled={loading}
                required
                minLength={8}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowNewPassword(!showNewPassword)}
              >
                {showNewPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
            
            {newPassword && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${(passwordStrength / 5) * 100}%`,
                        backgroundColor: passwordStrengthColor,
                      }}
                    />
                  </div>
                  <span className="text-xs font-medium" style={{ color: passwordStrengthColor }}>
                    {passwordStrengthLabel}
                  </span>
                </div>
                
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className={newPassword.length >= 8 ? 'text-green-600' : ''}>
                    {newPassword.length >= 8 ? '✓' : '○'} At least 8 characters
                  </p>
                  <p className={/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword) ? 'text-green-600' : ''}>
                    {/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword) ? '✓' : '○'} Upper & lowercase letters
                  </p>
                  <p className={/\d/.test(newPassword) ? 'text-green-600' : ''}>
                    {/\d/.test(newPassword) ? '✓' : '○'} At least one number
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your new password"
              disabled={loading}
              required
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-red-600">Passwords do not match</p>
            )}
            {confirmPassword && newPassword === confirmPassword && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Passwords match
              </p>
            )}
          </div>

          {/* Security Option */}
          <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Checkbox
                id="revokeOtherSessions"
                checked={revokeOtherSessions}
                onCheckedChange={(checked) => setRevokeOtherSessions(checked as boolean)}
                disabled={loading}
              />
              <div className="space-y-1">
                <Label
                  htmlFor="revokeOtherSessions"
                  className="text-sm font-medium cursor-pointer flex items-center gap-2"
                >
                  <Shield className="h-4 w-4 text-primary" />
                  Sign out all other devices
                </Label>
                <p className="text-xs text-muted-foreground">
                  For security, we recommend signing out all other sessions when you change your password. 
                  You'll stay logged in on this device.
                </p>
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
            className="w-full"
          >
            {loading ? 'Changing Password...' : 'Change Password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
