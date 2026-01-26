'use client'

import { useState, useEffect } from 'react'
import * as React from 'react'
import {
  Building2,
  Users,
  Crown,
  Shield,
  User as UserIcon,
  Settings,
  UserPlus,
  Mail,
  MoreHorizontal,
  ChevronRight,
  Plus,
} from 'lucide-react'

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/ui-components/avatar'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/ui-components/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui-components/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui-components/dropdown-menu'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { Badge } from '@/ui-components/badge'
import { Separator } from '@/ui-components/separator'
import { useActiveOrganization, useListOrganizations, organizationAPI } from '@/lib/better-auth-client'
import { useOrganizationInvite } from '@/hooks/useOrganizationInvite'
import { useOrganizationMembers } from '@/hooks/useOrganizationMembers'
import { useOrganizationCreate } from '@/hooks/useOrganizationCreate'
import { toast } from 'sonner'

interface OrganizationMenuProps {
  onClose?: () => void
}

export function OrganizationMenu({ onClose }: OrganizationMenuProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', slug: '' })
  
  const { data: currentOrg } = useActiveOrganization()
  const { data: organizations, isPending: orgsLoading, refetch: refetchOrgs } = useListOrganizations()
  
  // Use custom hooks for organization management
  const { inviteMember, loading: inviting } = useOrganizationInvite(currentOrg?.id || '')
  const { members, invitations, loading: loadingMembers, reload: reloadMembers, stats } = useOrganizationMembers(
    currentOrg?.id || '',
    { autoLoad: false }
  )
  const { create, loading: creating, generateSlug } = useOrganizationCreate()
  
  // Auto-load members when details view is shown
  useEffect(() => {
    if (showDetails && currentOrg?.id) {
      reloadMembers()
    }
  }, [showDetails, currentOrg?.id, reloadMembers])

  const getRoleIcon = (role: string | string[]) => {
    const roleStr = Array.isArray(role) ? role[0] : role
    switch (roleStr?.toLowerCase()) {
      case 'owner':
        return <Crown className="h-4 w-4 text-yellow-600" />
      case 'admin':
        return <Shield className="h-4 w-4 text-blue-600" />
      default:
        return <UserIcon className="h-4 w-4 text-gray-500" />
    }
  }

  const getRoleBadge = (role: string | string[]) => {
    const roleStr = Array.isArray(role) ? role[0] : role
    const roleConfig = {
      owner: { 
        bg: 'bg-gradient-to-r from-yellow-500 to-amber-600', 
        text: 'text-white',
        icon: <Crown className="h-3 w-3" />
      },
      admin: { 
        bg: 'bg-gradient-to-r from-blue-500 to-indigo-600', 
        text: 'text-white',
        icon: <Shield className="h-3 w-3" />
      },
      member: { 
        bg: 'bg-gray-100 border border-gray-200', 
        text: 'text-gray-700',
        icon: <UserIcon className="h-3 w-3" />
      },
    }
    
    const config = roleConfig[roleStr?.toLowerCase() as keyof typeof roleConfig] || roleConfig.member
    
    return (
      <Badge className={`text-xs flex items-center gap-1 ${config.bg} ${config.text} border-0`}>
        {config.icon}
        <span className="capitalize">{roleStr}</span>
      </Badge>
    )
  }

  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [inviteForm, setInviteForm] = useState<{ email: string; role: 'member' | 'admin' | 'owner' }>({ 
    email: '', 
    role: 'member' 
  })

  const handleInviteUser = async () => {
    if (!currentOrg?.id) return
    
    const result = await inviteMember(inviteForm.email, inviteForm.role)
    if (result.success) {
      setShowInviteDialog(false)
      setInviteForm({ email: '', role: 'member' })
      reloadMembers() // Reload to show new invitation
    }
  }

  const handleCreateOrganization = async () => {
    const org = await create(createForm.name, createForm.slug)
    if (org) {
      setShowCreateDialog(false)
      setCreateForm({ name: '', slug: '' })
      refetchOrgs()
    }
  }

  if (!currentOrg) {
    // Check if user has organizations but none is active
    const hasOrganizations = organizations && organizations.length > 0
    
    return (
      <div className="min-w-72">
        <div className="p-3 text-center">
          <Building2 className="h-6 w-6 text-gray-400 mx-auto mb-2" />
          <p className="text-xs text-gray-500 mb-3">
            {hasOrganizations ? 'No organization selected' : 'No organizations yet'}
          </p>
          
          {hasOrganizations ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">Select an organization:</p>
              <div className="space-y-1">
                {organizations?.map((org) => (
                  <Button
                    key={org.id}
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={async () => {
                      try {
                        await organizationAPI.setActive({ organizationId: org.id })
                        toast.success(`Switched to ${org.name}`)
                        refetchOrgs()
                      } catch (error) {
                        toast.error('Failed to set active organization')
                      }
                    }}
                  >
                    {org.name}
                  </Button>
                ))}
              </div>
              <Separator className="my-2" />
            </div>
          ) : null}
          
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="w-full">
                <Plus className="h-3 w-3 mr-2" />
                Create Organization
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Organization</DialogTitle>
                <DialogDescription>
                  Create a new organization to collaborate with your team.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="org-name">Organization Name</Label>
                  <Input
                    id="org-name"
                    placeholder="Enter organization name"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ 
                      ...createForm, 
                      name: e.target.value,
                      slug: createForm.slug || e.target.value.toLowerCase().replace(/\s+/g, '-')
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="org-slug">Organization Slug</Label>
                  <Input
                    id="org-slug"
                    placeholder="organization-slug"
                    value={createForm.slug}
                    onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Used in URLs and must be unique
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateOrganization} disabled={creating}>
                  {creating ? 'Creating...' : 'Create Organization'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    )
  }

  return (
    <div className="min-w-72">
      {/* Organization Header */}
      <div className="p-3 border-b">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm truncate">{currentOrg.name}</h3>
            <p className="text-xs text-gray-500 truncate">
              Organization
            </p>
          </div>
          <Dialog open={showDetails} onOpenChange={setShowDetails}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {currentOrg.name}
                </DialogTitle>
                <DialogDescription>
                  Organization details, members, and settings
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* Organization Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Organization Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <div className="text-xs text-blue-600 font-medium mb-1">Total Members</div>
                        <div className="text-2xl font-bold text-blue-700">{stats.totalMembers}</div>
                      </div>
                      <div className="p-3 bg-amber-50 rounded-lg">
                        <div className="text-xs text-amber-600 font-medium mb-1">Pending</div>
                        <div className="text-2xl font-bold text-amber-700">{stats.pendingInvitations}</div>
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex justify-between items-center py-1">
                        <span className="text-sm text-gray-600">Organization Name</span>
                        <span className="text-sm font-semibold">{currentOrg.name}</span>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-sm text-gray-600">Slug</span>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">{currentOrg.slug}</code>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-sm text-gray-600">Organization ID</span>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono truncate max-w-[200px]" title={currentOrg.id}>
                          {currentOrg.id.substring(0, 12)}...
                        </code>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-sm text-gray-600">Created</span>
                        <span className="text-sm">
                          {new Date(currentOrg.createdAt).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Members Section */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Members ({stats.totalMembers})
                      </CardTitle>
                      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
                        <DialogTrigger asChild>
                          <Button size="sm">
                            <UserPlus className="h-4 w-4 mr-2" />
                            Invite
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Invite Member</DialogTitle>
                            <DialogDescription>
                              Send an invitation to join {currentOrg.name}
                            </DialogDescription>
                          </DialogHeader>
                          
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="invite-email">Email Address</Label>
                              <Input
                                id="invite-email"
                                type="email"
                                placeholder="colleague@example.com"
                                value={inviteForm.email}
                                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !inviting) {
                                    handleInviteUser()
                                  }
                                }}
                              />
                            </div>
                            <div>
                              <Label htmlFor="invite-role">Role</Label>
                              <select
                                id="invite-role"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={inviteForm.role}
                                onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as 'member' | 'admin' | 'owner' })}
                              >
                                <option value="member">Member</option>
                                <option value="admin">Admin</option>
                              </select>
                              <p className="text-xs text-gray-500 mt-1">
                                {inviteForm.role === 'admin' 
                                  ? 'Admins can manage members and organization settings'
                                  : 'Members can access organization workspaces'}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex justify-end gap-2 mt-6">
                            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
                              Cancel
                            </Button>
                            <Button onClick={handleInviteUser} disabled={inviting}>
                              {inviting ? 'Sending...' : 'Send Invitation'}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loadingMembers ? (
                      <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                      </div>
                    ) : members.length === 0 ? (
                      <div className="text-center py-6 text-gray-500">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No members yet</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {members.map((member) => (
                          <div key={member.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <Avatar className="h-9 w-9 border-2 border-gray-100">
                                <AvatarImage src={member.user?.image || undefined} />
                                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs font-medium">
                                  {member.user?.name?.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || 
                                   member.user?.email?.substring(0, 2).toUpperCase() || 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium truncate">
                                    {member.user?.name || 'Unknown User'}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-500 truncate">
                                  {member.user?.email}
                                </div>
                                <div className="text-xs text-gray-400 mt-0.5">
                                  Joined {new Date(member.created_at).toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric',
                                    year: new Date(member.created_at).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                                  })}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {getRoleBadge(member.role)}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem>Change Role</DropdownMenuItem>
                                  <DropdownMenuItem className="text-red-600">
                                    Remove Member
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Pending Invitations */}
                {invitations.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Mail className="h-4 w-4 text-blue-600" />
                        Pending Invitations ({invitations.length})
                      </CardTitle>
                      <CardDescription className="text-xs">
                        These users have been invited but haven't accepted yet
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {invitations.map((invitation) => (
                          <div key={invitation.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-9 h-9 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <Mail className="h-4 w-4 text-blue-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{invitation.email}</div>
                                <div className="text-xs text-gray-500 flex items-center gap-1">
                                  <span>Role:</span>
                                  <span className="font-medium">
                                    {Array.isArray(invitation.role) ? invitation.role.join(', ') : invitation.role}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-400 mt-0.5">
                                  {new Date(invitation.created_at).toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit'
                                  })}
                                  {invitation.expires_at && (
                                    <span className="ml-2">
                                      • Expires {new Date(invitation.expires_at).toLocaleDateString('en-US', { 
                                        month: 'short', 
                                        day: 'numeric'
                                      })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {getRoleBadge(invitation.role)}
                              <Badge variant="outline" className="text-xs border-amber-200 text-amber-700 bg-amber-50">
                                Pending
                              </Badge>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem 
                                    onClick={async () => {
                                      try {
                                        await organizationAPI.cancelInvitation({ invitationId: invitation.id })
                                        toast.success('Invitation cancelled')
                                        reloadMembers()
                                      } catch (error) {
                                        toast.error('Failed to cancel invitation')
                                      }
                                    }}
                                    className="text-red-600"
                                  >
                                    Cancel Invitation
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="p-3">
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="p-2 bg-blue-50 rounded-md">
            <div className="text-sm font-semibold text-blue-700">{stats.totalMembers}</div>
            <div className="text-xs text-blue-600">Members</div>
          </div>
          <div className="p-2 bg-purple-50 rounded-md">
            <div className="text-sm font-semibold text-purple-700">{stats.pendingInvitations}</div>
            <div className="text-xs text-purple-600">Pending</div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Quick Actions */}
      <div className="p-2 space-y-1">
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full justify-start h-8"
          onClick={() => setShowInviteDialog(true)}
        >
          <UserPlus className="h-3 w-3 mr-2" />
          Invite Members
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full justify-start h-8"
          onClick={() => setShowDetails(true)}
        >
          <Settings className="h-3 w-3 mr-2" />
          Organization Settings
        </Button>
      </div>
    </div>
  )
}