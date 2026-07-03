"use client"

import { useEffect, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from '@/ui-components/sheet'
import { ScrollArea } from '@/ui-components/scroll-area'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/ui-components/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/ui-components/card'
import { Badge } from '@/ui-components/badge'
import { User, Camera, Loader2, Shield, Key, Trash2 } from 'lucide-react'
import { authClient } from '@/auth/client/main'
import { storageClient } from '@/lib/api/storage-client'
import { toast } from 'sonner'
import { ProfileUpdateForm } from '@/components/auth/profile-update-form'
import { ChangePasswordForm } from '@/components/auth/change-password-form'
import { TwoFactorSection } from '@/components/auth/two-factor-section'
import { PasskeySection } from '@/components/auth/passkey-section'
import { AccountDeletion } from '@/components/auth/account-deletion'
import { SessionManagement } from '@/components/SessionManagement'

interface ProfileSidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function ProfileSidebar({ isOpen, onClose }: ProfileSidebarProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isAvatarUploading, setIsAvatarUploading] = useState(false)

  const [user, setUser] = useState<{
    id: string
    name: string
    email: string
    avatarUrl: string
    twoFactorEnabled: boolean
  } | null>(null)

  useEffect(() => {
    if (!isOpen) return

    const loadUserData = async () => {
      setIsLoading(true)
      try {
        const session = await authClient.getSession()
        const sessionUser = session?.data?.user
        if (sessionUser) {
          setUser({
            id: sessionUser.id,
            name: sessionUser.name || '',
            email: sessionUser.email || '',
            avatarUrl: sessionUser.image || (sessionUser as any).avatarUrl || '',
            twoFactorEnabled: (sessionUser as any).twoFactorEnabled ?? false,
          })
        }
      } catch (error) {
        console.error('Failed to load user data:', error)
        toast.error('Failed to load profile')
      } finally {
        setIsLoading(false)
      }
    }

    loadUserData()
  }, [isOpen])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

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
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}_${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      const { error: uploadError } = await storageClient
        .from('user-assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = storageClient
        .from('user-assets')
        .getPublicUrl(filePath)

      if (user.avatarUrl && user.avatarUrl.includes('user-assets')) {
        const oldPath = user.avatarUrl.split('/user-assets/').pop()
        if (oldPath) {
          await storageClient.from('user-assets').remove([oldPath])
        }
      }

      await authClient.updateUser({ image: publicUrl })
      setUser({ ...user, avatarUrl: publicUrl })
      toast.success('Photo uploaded successfully')
    } catch (error: any) {
      console.error('Avatar upload error:', error)
      toast.error(error.message || 'Failed to upload photo')
    } finally {
      setIsAvatarUploading(false)
    }
  }

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

        {isLoading || !user ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="p-6">
              <Tabs defaultValue="profile">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="profile">Profile</TabsTrigger>
                  <TabsTrigger value="security">Security</TabsTrigger>
                  <TabsTrigger value="sessions">Sessions</TabsTrigger>
                  <TabsTrigger value="danger">Danger</TabsTrigger>
                </TabsList>

                <TabsContent value="profile" className="space-y-6 mt-6">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-2xl font-semibold overflow-hidden">
                        {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          getInitials(user.name, user.email)
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
                      <h3 className="font-medium text-gray-900">{user.name || 'Add your name'}</h3>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                  </div>

                  <ProfileUpdateForm user={{ name: user.name, email: user.email }} />
                </TabsContent>

                <TabsContent value="security" className="space-y-6 mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Key className="h-4 w-4" />
                        Password
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ChangePasswordForm email={user.email} />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Shield className="h-4 w-4" />
                        Two-Factor Authentication
                      </CardTitle>
                      <Badge variant={user.twoFactorEnabled ? 'default' : 'secondary'}>
                        {user.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <TwoFactorSection isEnabled={user.twoFactorEnabled} />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Passkeys</CardTitle>
                      <CardDescription>Sign in without a password using your device.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <PasskeySection />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="sessions" className="mt-6">
                  <SessionManagement />
                </TabsContent>

                <TabsContent value="danger" className="mt-6">
                  <Card className="border-destructive">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base text-destructive">
                        <Trash2 className="h-4 w-4" />
                        Danger Zone
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <AccountDeletion />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  )
}
