"use client"

import { useState, useEffect } from 'react'
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetDescription 
} from '@/ui-components/sheet'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { ScrollArea } from '@/ui-components/scroll-area'
import { Separator } from '@/ui-components/separator'
import { 
  User, 
  Mail, 
  Phone, 
  Building2,
  Camera,
  Loader2,
  Check,
  Shield,
  Bell,
  Key
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Switch } from '@/ui-components/switch'

interface ProfileSidebarProps {
  isOpen: boolean
  onClose: () => void
}

type ProfileSection = 'profile' | 'notifications' | 'security'

export function ProfileSidebar({ isOpen, onClose }: ProfileSidebarProps) {
  const [activeSection, setActiveSection] = useState<ProfileSection>('profile')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isAvatarUploading, setIsAvatarUploading] = useState(false)
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false)

  // Profile fields
  const [email, setEmail] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [originalEmail, setOriginalEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [organization, setOrganization] = useState('')
  const [role, setRole] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')

  // Notification preferences
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(true)
  const [weeklyDigest, setWeeklyDigest] = useState(false)

  // Load user data
  useEffect(() => {
    const loadUserData = async () => {
      setIsLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setEmail(user.email || '')
          setNewEmail(user.email || '')
          setOriginalEmail(user.email || '')
          setFullName(user.user_metadata?.full_name || user.user_metadata?.name || '')
          setPhone(user.user_metadata?.phone || '')
          setOrganization(user.user_metadata?.organization || '')
          setRole(user.user_metadata?.role || '')
          setAvatarUrl(user.user_metadata?.avatar_url || '')
          
          // Load notification preferences from user metadata
          const prefs = user.user_metadata?.notification_preferences || {}
          setEmailNotifications(prefs.email !== false)
          setPushNotifications(prefs.push !== false)
          setWeeklyDigest(prefs.weekly_digest === true)
        }
      } catch (error) {
        console.error('Failed to load user data:', error)
        toast.error('Failed to load profile')
      } finally {
        setIsLoading(false)
      }
    }

    if (isOpen) {
      loadUserData()
    }
  }, [isOpen])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB')
      return
    }

    setIsAvatarUploading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}_${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('user-assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('user-assets')
        .getPublicUrl(filePath)

      // Delete old avatar if exists
      if (avatarUrl && avatarUrl.includes('user-assets')) {
        const oldPath = avatarUrl.split('/user-assets/').pop()
        if (oldPath) {
          await supabase.storage.from('user-assets').remove([oldPath])
        }
      }

      setAvatarUrl(publicUrl)
      toast.success('Photo uploaded successfully')
    } catch (error: any) {
      console.error('Avatar upload error:', error)
      toast.error(error.message || 'Failed to upload photo')
    } finally {
      setIsAvatarUploading(false)
    }
  }

  const handleUpdateEmail = async () => {
    if (!newEmail || newEmail === originalEmail) return
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmail)) {
      toast.error('Please enter a valid email address')
      return
    }

    setIsUpdatingEmail(true)
    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail
      })

      if (error) throw error

      toast.success('Confirmation email sent! Please check both your old and new email addresses to confirm the change.')
      setEmail(newEmail)
    } catch (error: any) {
      console.error('Failed to update email:', error)
      toast.error(error.message || 'Failed to update email')
    } finally {
      setIsUpdatingEmail(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)

    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          phone,
          organization,
          role,
          avatar_url: avatarUrl,
          notification_preferences: {
            email: emailNotifications,
            push: pushNotifications,
            weekly_digest: weeklyDigest
          }
        }
      })

      if (error) throw error

      toast.success('Profile updated successfully')
      onClose()
    } catch (error: any) {
      console.error('Failed to update profile:', error)
      toast.error(error.message || 'Failed to save profile')
    } finally {
      setIsSaving(false)
    }
  }

  const sections = [
    { id: 'profile' as ProfileSection, label: 'Profile', icon: User },
    { id: 'notifications' as ProfileSection, label: 'Notifications', icon: Bell },
    { id: 'security' as ProfileSection, label: 'Security', icon: Shield },
  ]

  const getInitials = (name: string, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }
    return email?.charAt(0).toUpperCase() || 'U'
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <SheetTitle className="text-lg">My Profile</SheetTitle>
              <SheetDescription className="text-sm text-gray-500">
                Manage your account settings
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex flex-1 min-h-0">
          {/* Sidebar Navigation */}
          <div className="w-44 border-r border-gray-100 bg-gray-50/30 p-3 flex-shrink-0">
            <nav className="space-y-1">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                    activeSection === section.id
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:bg-white/50 hover:text-gray-900"
                  )}
                >
                  <section.icon className="w-4 h-4" />
                  {section.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content Area */}
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="p-6 space-y-6">
                {activeSection === 'profile' && (
                  <>
                    {/* Avatar */}
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-2xl font-semibold overflow-hidden">
                          {avatarUrl ? (
                            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            getInitials(fullName, email)
                          )}
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarUpload}
                          disabled={isAvatarUploading}
                          className="hidden"
                          id="avatar-upload"
                        />
                        <button
                          onClick={() => document.getElementById('avatar-upload')?.click()}
                          disabled={isAvatarUploading}
                          className="absolute -bottom-1 -right-1 p-1.5 bg-white border border-gray-200 rounded-full shadow-sm hover:bg-gray-50 transition-colors"
                        >
                          {isAvatarUploading ? (
                            <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                          ) : (
                            <Camera className="w-4 h-4 text-gray-600" />
                          )}
                        </button>
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{fullName || 'Add your name'}</h3>
                        <p className="text-sm text-gray-500">{email}</p>
                      </div>
                    </div>

                    <Separator />

                    {/* Full Name */}
                    <div className="space-y-2">
                      <Label htmlFor="full-name" className="text-sm font-medium">
                        Full Name
                      </Label>
                      <Input
                        id="full-name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="John Doe"
                        className="bg-gray-50/50"
                      />
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium">
                        Email Address
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          id="email"
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="pl-10 bg-gray-50/50"
                        />
                      </div>
                      {newEmail !== originalEmail && (
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-amber-600">
                            A confirmation will be sent to both emails
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleUpdateEmail}
                            disabled={isUpdatingEmail || !newEmail}
                            className="h-7 text-xs"
                          >
                            {isUpdatingEmail ? (
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            ) : null}
                            Update Email
                          </Button>
                        </div>
                      )}
                      {newEmail === originalEmail && (
                        <p className="text-xs text-gray-500">
                          Changing your email requires confirmation
                        </p>
                      )}
                    </div>

                    {/* Phone */}
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-sm font-medium">
                        Phone Number
                      </Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          id="phone"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+1 (555) 000-0000"
                          className="pl-10 bg-gray-50/50"
                        />
                      </div>
                    </div>

                    {/* Organization */}
                    <div className="space-y-2">
                      <Label htmlFor="organization" className="text-sm font-medium">
                        Organization
                      </Label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          id="organization"
                          value={organization}
                          onChange={(e) => setOrganization(e.target.value)}
                          placeholder="Company or organization name"
                          className="pl-10 bg-gray-50/50"
                        />
                      </div>
                    </div>

                    {/* Role */}
                    <div className="space-y-2">
                      <Label htmlFor="role" className="text-sm font-medium">
                        Job Title
                      </Label>
                      <Input
                        id="role"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        placeholder="e.g., Program Manager"
                        className="bg-gray-50/50"
                      />
                    </div>
                  </>
                )}

                {activeSection === 'notifications' && (
                  <>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-medium">Email Notifications</Label>
                          <p className="text-xs text-gray-500">
                            Receive updates and alerts via email
                          </p>
                        </div>
                        <Switch
                          checked={emailNotifications}
                          onCheckedChange={setEmailNotifications}
                        />
                      </div>

                      <Separator />

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-medium">Push Notifications</Label>
                          <p className="text-xs text-gray-500">
                            Receive browser push notifications
                          </p>
                        </div>
                        <Switch
                          checked={pushNotifications}
                          onCheckedChange={setPushNotifications}
                        />
                      </div>

                      <Separator />

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-medium">Weekly Digest</Label>
                          <p className="text-xs text-gray-500">
                            Get a weekly summary of activity
                          </p>
                        </div>
                        <Switch
                          checked={weeklyDigest}
                          onCheckedChange={setWeeklyDigest}
                        />
                      </div>
                    </div>
                  </>
                )}

                {activeSection === 'security' && (
                  <>
                    <div className="space-y-4">
                      {/* Change Password */}
                      <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-white rounded-lg shadow-sm">
                            <Key className="w-5 h-5 text-gray-600" />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-sm font-medium text-gray-900">Password</h4>
                            <p className="text-xs text-gray-500 mt-0.5">
                              Change your account password
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-3"
                              onClick={async () => {
                                try {
                                  await supabase.auth.resetPasswordForEmail(email, {
                                    redirectTo: `${window.location.origin}/auth/reset-password`
                                  })
                                  toast.success('Password reset email sent!')
                                } catch (error) {
                                  toast.error('Failed to send reset email')
                                }
                              }}
                            >
                              Reset Password
                            </Button>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Active Sessions */}
                      <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-white rounded-lg shadow-sm">
                            <Shield className="w-5 h-5 text-gray-600" />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-sm font-medium text-gray-900">Active Sessions</h4>
                            <p className="text-xs text-gray-500 mt-0.5">
                              Manage your active login sessions
                            </p>
                            <div className="mt-3 p-3 bg-white rounded-lg border border-gray-100">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full" />
                                <span className="text-sm text-gray-700">Current Session</span>
                                <Check className="w-4 h-4 text-green-500 ml-auto" />
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                Active now
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
