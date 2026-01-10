'use client'

import { useState } from 'react'
import { X, User, Lock, Loader2, Check, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { portalAuthClient } from '@/lib/api/portal-auth-client'
import { authClient } from '@/lib/better-auth-client'
import { toast } from 'sonner'

interface AccountSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  applicantId: string
  currentName: string
  email: string
  onNameUpdate: (newName: string) => void
  themeColor?: string
  currentFirstName?: string
  currentLastName?: string
  onNameUpdateFull?: (firstName: string, lastName: string) => void
}

export function AccountSettingsModal({
  isOpen,
  onClose,
  applicantId,
  currentName,
  email,
  onNameUpdate,
  themeColor = '#3B82F6',
  currentFirstName = '',
  currentLastName = '',
  onNameUpdateFull
}: AccountSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile')
  
  // Profile state - parse current name if we don't have separate fields
  const parseName = (fullName: string) => {
    if (currentFirstName && currentLastName) {
      return { first: currentFirstName, last: currentLastName }
    }
    const parts = fullName.trim().split(/\s+/)
    if (parts.length >= 2) {
      return { first: parts[0], last: parts.slice(1).join(' ') }
    }
    return { first: parts[0] || '', last: '' }
  }
  
  const initialName = parseName(currentName)
  const [firstName, setFirstName] = useState(initialName.first)
  const [lastName, setLastName] = useState(initialName.last)
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  
  // Password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  if (!isOpen) return null

  const handleUpdateProfile = async () => {
    if (!firstName.trim()) {
      toast.error('First name cannot be empty')
      return
    }

    setIsUpdatingProfile(true)
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim()
      
      // Update Better Auth user profile (if method is available)
      try {
        // Check if updateUser method exists on authClient
        if (typeof (authClient as any).updateUser === 'function') {
          const result = await (authClient as any).updateUser({
            name: fullName,
          })
          
          if (result?.error) {
            console.warn('Failed to update Better Auth profile:', result.error)
          }
        }
      } catch (baError) {
        console.warn('Better Auth update failed, continuing with portal update:', baError)
      }
      
      // Also update portal applicant for form-specific data
      try {
        await portalAuthClient.updateProfile(applicantId, { 
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          full_name: fullName
        })
      } catch (portalError) {
        console.warn('Portal applicant update failed:', portalError)
      }
      
      // Update both callbacks for backward compatibility
      onNameUpdate(fullName)
      onNameUpdateFull?.(firstName.trim(), lastName.trim())
      toast.success('Profile updated successfully')
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile')
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  const handleChangePassword = async () => {
    if (!currentPassword) {
      toast.error('Please enter your current password')
      return
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setIsChangingPassword(true)
    try {
      await portalAuthClient.changePassword(applicantId, currentPassword, newPassword)
      toast.success('Password changed successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      toast.error(error.message || 'Failed to change password')
    } finally {
      setIsChangingPassword(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Account Settings</h2>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'profile'
                ? 'border-b-2 text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            style={activeTab === 'profile' ? { borderBottomColor: themeColor } : {}}
          >
            <User className="w-4 h-4" />
            Profile
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'password'
                ? 'border-b-2 text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            style={activeTab === 'password' ? { borderBottomColor: themeColor } : {}}
          >
            <Lock className="w-4 h-4" />
            Password
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'profile' ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  disabled
                  className="mt-1 bg-gray-50 text-gray-500"
                />
                <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
              </div>
              
              <div>
                <Label htmlFor="firstName" className="text-sm font-medium text-gray-700">
                  First Name
                </Label>
                <Input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Enter your first name"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="lastName" className="text-sm font-medium text-gray-700">
                  Last Name
                </Label>
                <Input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Enter your last name"
                  className="mt-1"
                />
              </div>

              <Button
                onClick={handleUpdateProfile}
                disabled={isUpdatingProfile || (firstName === initialName.first && lastName === initialName.last)}
                className="w-full text-white"
                style={{ backgroundColor: themeColor }}
              >
                {isUpdatingProfile ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="currentPassword" className="text-sm font-medium text-gray-700">
                  Current Password
                </Label>
                <div className="relative mt-1">
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              
              <div>
                <Label htmlFor="newPassword" className="text-sm font-medium text-gray-700">
                  New Password
                </Label>
                <div className="relative mt-1">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">Minimum 8 characters</p>
              </div>
              
              <div>
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                  Confirm New Password
                </Label>
                <div className="relative mt-1">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                onClick={handleChangePassword}
                disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
                className="w-full text-white"
                style={{ backgroundColor: themeColor }}
              >
                {isChangingPassword ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Changing Password...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Change Password
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
