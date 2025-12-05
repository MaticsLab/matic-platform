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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui-components/select'
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
import { 
  Upload, 
  Palette, 
  Globe, 
  AlertCircle, 
  Check, 
  Settings,
  Building2,
  Image,
  Loader2,
  Users,
  Trash2,
  UserX
} from 'lucide-react'
import { workspacesClient } from '@/lib/api/workspaces-client'
import { workspacesSupabase } from '@/lib/api/workspaces-supabase'
import { adminClient, type AuthUser } from '@/lib/api/admin-client'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { Workspace } from '@/types/workspaces'
import { cn } from '@/lib/utils'

interface WorkspaceSettingsSidebarProps {
  isOpen: boolean
  onClose: () => void
  workspace: Workspace
  onUpdate: (workspace: Workspace) => void
}

const COLOR_PRESETS = [
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Amber', value: '#F59E0B' },
  { name: 'Green', value: '#10B981' },
  { name: 'Teal', value: '#14B8A6' },
  { name: 'Cyan', value: '#06B6D4' },
  { name: 'Indigo', value: '#6366F1' },
  { name: 'Violet', value: '#7C3AED' },
  { name: 'Fuchsia', value: '#D946EF' },
]

const APP_DOMAIN = 'maticapp.com'

type SettingsSection = 'general' | 'branding' | 'domain' | 'users'

export function WorkspaceSettingsSidebar({ isOpen, onClose, workspace, onUpdate }: WorkspaceSettingsSidebarProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('general')
  const [name, setName] = useState(workspace.name)
  const [description, setDescription] = useState(workspace.description || '')
  const [color, setColor] = useState(workspace.color || '#3B82F6')
  const [icon, setIcon] = useState(workspace.icon || '')
  const [logoUrl, setLogoUrl] = useState(workspace.logo_url || '')
  const [customSubdomain, setCustomSubdomain] = useState((workspace as any).custom_subdomain || '')
  const [isLogoUploading, setIsLogoUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [subdomainError, setSubdomainError] = useState<string | null>(null)

  // User management state
  const [authUsers, setAuthUsers] = useState<AuthUser[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [userToDelete, setUserToDelete] = useState<AuthUser | null>(null)
  const [reassignToUserId, setReassignToUserId] = useState<string>('')
  const [isDeletingUser, setIsDeletingUser] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Reset form when workspace changes
  useEffect(() => {
    setName(workspace.name)
    setDescription(workspace.description || '')
    setColor(workspace.color || '#3B82F6')
    setIcon(workspace.icon || '')
    setLogoUrl(workspace.logo_url || '')
    setCustomSubdomain((workspace as any).custom_subdomain || '')
    setSubdomainError(null)
  }, [workspace])

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setIsLogoUploading(true)

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${workspace.id}_${Date.now()}.${fileExt}`
      const filePath = `workspace-logos/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('workspace-assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('workspace-assets')
        .getPublicUrl(filePath)

      if (logoUrl && logoUrl.includes('workspace-assets')) {
        const oldPath = logoUrl.split('/workspace-assets/').pop()
        if (oldPath) {
          await supabase.storage.from('workspace-assets').remove([oldPath])
        }
      }

      setLogoUrl(publicUrl)
      toast.success('Logo uploaded successfully')
    } catch (error: any) {
      console.error('Logo upload error:', error)
      toast.error(error.message || 'Failed to upload logo')
    } finally {
      setIsLogoUploading(false)
    }
  }

  const handleRemoveLogo = async () => {
    if (!logoUrl) return

    try {
      if (logoUrl.includes('workspace-assets')) {
        const filePath = logoUrl.split('/workspace-assets/').pop()
        if (filePath) {
          await supabase.storage.from('workspace-assets').remove([filePath])
        }
      }
      setLogoUrl('')
      toast.success('Logo removed')
    } catch (error) {
      console.error('Error removing logo:', error)
      toast.error('Failed to remove logo')
    }
  }

  const isValidSubdomain = (subdomain: string): boolean => {
    if (!subdomain) return true
    if (subdomain.length < 3 || subdomain.length > 63) return false
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(subdomain)) return false
    if (subdomain.includes('--')) return false
    
    const reserved = ['forms', 'www', 'api', 'app', 'admin', 'dashboard', 'portal',
      'mail', 'email', 'help', 'support', 'status', 'blog', 'docs', 'dev', 
      'staging', 'test', 'demo', 'cdn', 'assets', 'static', 'auth', 'login', 
      'signup', 'register', 'account', 'billing', 'matic', 'maticapp', 'apply']
    return !reserved.includes(subdomain)
  }

  const handleSubdomainChange = (value: string) => {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, '')
    setCustomSubdomain(cleaned)
    
    if (cleaned && !isValidSubdomain(cleaned)) {
      setSubdomainError('Must be 3-63 characters, lowercase alphanumeric with hyphens. No reserved names.')
    } else {
      setSubdomainError(null)
    }
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Workspace name is required')
      return
    }

    if (customSubdomain && !isValidSubdomain(customSubdomain)) {
      toast.error('Invalid subdomain format')
      return
    }

    setIsSaving(true)

    try {
      const basicUpdates = {
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        icon: icon || undefined,
        logo_url: logoUrl || undefined,
      }

      await workspacesSupabase.updateWorkspace(workspace.id, basicUpdates)

      if (customSubdomain !== ((workspace as any).custom_subdomain || '')) {
        try {
          await workspacesClient.updateCustomSubdomain(workspace.id, customSubdomain || null)
        } catch (err: any) {
          const errorMsg = err?.message || 'Failed to update subdomain'
          toast.error(errorMsg)
          setSubdomainError(errorMsg)
          setIsSaving(false)
          return
        }
      }

      const updatedWorkspace = await workspacesClient.get(workspace.id)
      
      onUpdate(updatedWorkspace as any)
      toast.success('Settings saved!')
      onClose()
    } catch (error) {
      console.error('Failed to update workspace:', error)
      toast.error('Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  const sections = [
    { id: 'general' as SettingsSection, label: 'General', icon: Building2 },
    { id: 'branding' as SettingsSection, label: 'Branding', icon: Palette },
    { id: 'domain' as SettingsSection, label: 'Domain', icon: Globe },
    { id: 'users' as SettingsSection, label: 'Users', icon: Users },
  ]

  // Fetch current user and users list when Users section is active
  useEffect(() => {
    const fetchCurrentUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.id) {
        setCurrentUserId(session.user.id)
      }
    }
    fetchCurrentUser()
  }, [])

  useEffect(() => {
    if (activeSection === 'users') {
      loadUsers()
    }
  }, [activeSection])

  const loadUsers = async () => {
    setIsLoadingUsers(true)
    try {
      const users = await adminClient.listUsers()
      setAuthUsers(users)
    } catch (error: any) {
      console.error('Error loading users:', error)
      toast.error(error.message || 'Failed to load users')
    } finally {
      setIsLoadingUsers(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!userToDelete) return

    setIsDeletingUser(true)
    try {
      await adminClient.deleteUser(userToDelete.id, reassignToUserId || undefined)
      toast.success(`User ${userToDelete.email} deleted successfully`)
      setUserToDelete(null)
      setReassignToUserId('')
      loadUsers()
    } catch (error: any) {
      console.error('Error deleting user:', error)
      toast.error(error.message || 'Failed to delete user')
    } finally {
      setIsDeletingUser(false)
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Settings className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <SheetTitle className="text-lg">Workspace Settings</SheetTitle>
              <SheetDescription className="text-sm text-gray-500">
                Manage your workspace configuration
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
            <div className="p-6 space-y-6">
              {activeSection === 'general' && (
                <>
                  {/* Workspace Name */}
                  <div className="space-y-2">
                    <Label htmlFor="workspace-name" className="text-sm font-medium">
                      Workspace Name
                    </Label>
                    <Input
                      id="workspace-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="My Workspace"
                      maxLength={100}
                      className="bg-gray-50/50"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Label htmlFor="workspace-description" className="text-sm font-medium">
                      Description
                    </Label>
                    <textarea
                      id="workspace-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="What's this workspace for?"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm bg-gray-50/50"
                      rows={3}
                      maxLength={500}
                    />
                    <p className="text-xs text-gray-500">
                      {description.length}/500 characters
                    </p>
                  </div>

                  {/* Icon/Emoji */}
                  <div className="space-y-2">
                    <Label htmlFor="workspace-icon" className="text-sm font-medium">
                      Workspace Icon
                    </Label>
                    <div className="flex items-center gap-3">
                      <Input
                        id="workspace-icon"
                        value={icon}
                        onChange={(e) => setIcon(e.target.value)}
                        placeholder="🚀"
                        maxLength={2}
                        className="w-16 text-center text-xl bg-gray-50/50"
                      />
                      <span className="text-sm text-gray-500">
                        Use an emoji to represent your workspace
                      </span>
                    </div>
                  </div>
                </>
              )}

              {activeSection === 'branding' && (
                <>
                  {/* Logo Upload */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Workspace Logo</Label>
                    <div className="flex items-start gap-4">
                      <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50">
                        {logoUrl ? (
                          <img src={logoUrl} alt="Workspace logo" className="w-full h-full object-cover" />
                        ) : (
                          <Image className="w-8 h-8 text-gray-300" />
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          disabled={isLogoUploading}
                          className="hidden"
                          id="logo-upload"
                        />
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isLogoUploading}
                            onClick={() => document.getElementById('logo-upload')?.click()}
                          >
                            {isLogoUploading ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Uploading...
                              </>
                            ) : (
                              <>
                                <Upload className="w-4 h-4 mr-2" />
                                Upload
                              </>
                            )}
                          </Button>
                          {logoUrl && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={handleRemoveLogo}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          PNG, JPG or GIF (max. 2MB)
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Color Picker */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Brand Color</Label>
                    <div className="grid grid-cols-6 gap-2">
                      {COLOR_PRESETS.map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => setColor(preset.value)}
                          className={cn(
                            "w-10 h-10 rounded-lg border-2 transition-all",
                            color === preset.value
                              ? "border-gray-900 scale-110 shadow-md"
                              : "border-transparent hover:scale-105"
                          )}
                          style={{ backgroundColor: preset.value }}
                          title={preset.name}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-3 pt-2">
                      <div className="relative">
                        <input
                          type="color"
                          value={color}
                          onChange={(e) => setColor(e.target.value)}
                          className="w-10 h-10 rounded-lg border-2 border-gray-200 cursor-pointer"
                          title="Custom color"
                        />
                        <Palette className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-white pointer-events-none mix-blend-difference" />
                      </div>
                      <span className="text-sm text-gray-600 font-mono">{color.toUpperCase()}</span>
                    </div>
                  </div>

                  <Separator />

                  {/* Preview */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Preview</Label>
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-semibold shadow-sm"
                          style={{ backgroundColor: color }}
                        >
                          {logoUrl ? (
                            <img src={logoUrl} alt="Logo" className="w-full h-full object-cover rounded-xl" />
                          ) : icon ? (
                            icon
                          ) : (
                            name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{name || 'Workspace Name'}</div>
                          {description && (
                            <div className="text-sm text-gray-500 line-clamp-1">{description}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeSection === 'domain' && (
                <>
                  {/* Custom Subdomain */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-blue-500" />
                      <Label htmlFor="workspace-subdomain" className="text-sm font-medium">
                        Custom Subdomain
                      </Label>
                    </div>
                    <p className="text-sm text-gray-500">
                      Set a custom subdomain for branded portal URLs. Your forms will be accessible at{' '}
                      <span className="font-mono text-gray-700">{customSubdomain || 'your-subdomain'}.{APP_DOMAIN}/form-slug</span>
                    </p>
                    <div className="flex items-center">
                      <Input
                        id="workspace-subdomain"
                        value={customSubdomain}
                        onChange={(e) => handleSubdomainChange(e.target.value)}
                        placeholder="your-organization"
                        maxLength={63}
                        className="rounded-r-none bg-gray-50/50"
                      />
                      <span className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-200 rounded-r-lg text-sm text-gray-600">
                        .{APP_DOMAIN}
                      </span>
                    </div>
                    {subdomainError && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {subdomainError}
                      </p>
                    )}
                    {customSubdomain && !subdomainError && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Valid subdomain: <span className="font-mono">{customSubdomain}.{APP_DOMAIN}</span>
                      </p>
                    )}
                  </div>
                </>
              )}

              {activeSection === 'users' && (
                <>
                  {/* Users Management */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-blue-500" />
                        <Label className="text-sm font-medium">All Users</Label>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={loadUsers}
                        disabled={isLoadingUsers}
                      >
                        {isLoadingUsers ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Refresh'
                        )}
                      </Button>
                    </div>
                    <p className="text-sm text-gray-500">
                      Manage all users in the system. When deleting a user, you can optionally reassign their data to another user.
                    </p>
                    
                    {isLoadingUsers ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                      </div>
                    ) : authUsers.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No users found
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {authUsers.map((user) => (
                          <div
                            key={user.id}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 truncate">
                                {user.email}
                              </div>
                              <div className="text-xs text-gray-500">
                                Created: {new Date(user.created_at).toLocaleDateString()}
                                {user.id === currentUserId && (
                                  <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                    You
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setUserToDelete(user)}
                              disabled={user.id === currentUserId}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </SheetContent>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <UserX className="w-5 h-5 text-red-500" />
              Delete User
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Are you sure you want to delete <strong>{userToDelete?.email}</strong>? This action cannot be undone.
              </p>
              <div className="space-y-2 pt-2">
                <Label className="text-sm font-medium text-gray-700">
                  Reassign data to (optional):
                </Label>
                <Select
                  value={reassignToUserId}
                  onValueChange={setReassignToUserId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Leave data orphaned (or select user)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Don't reassign (delete all data)</SelectItem>
                    {authUsers
                      .filter((u) => u.id !== userToDelete?.id && u.id !== currentUserId)
                      .map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.email}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  If you select a user, their workspaces, tables, and other content will be reassigned to that user.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingUser}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={isDeletingUser}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeletingUser ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete User'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  )
}
