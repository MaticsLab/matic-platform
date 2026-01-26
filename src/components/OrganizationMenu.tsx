'use client'

import { useState } from 'react'
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
import { toast } from 'sonner'

interface OrganizationMenuProps {
  onClose?: () => void
}

export function OrganizationMenu({ onClose }: OrganizationMenuProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', slug: '' })
  const [creating, setCreating] = useState(false)
  const { data: currentOrg } = useActiveOrganization()
  const { data: organizations, isPending: orgsLoading, refetch: refetchOrgs } = useListOrganizations()
  const [members, setMembers] = useState<any[]>([])
  const [invitations, setInvitations] = useState<any[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)

  const loadOrganizationDetails = async () => {
    if (!currentOrg?.id) return
    
    setLoadingMembers(true)
    try {
      // Load members
      const membersResponse = await organizationAPI.listMembers({
        query: { organizationId: currentOrg.id }
      })
      if (membersResponse.data?.members) {
        setMembers(membersResponse.data.members)
      }

      // Load invitations
      const invitationsResponse = await organizationAPI.listInvitations({
        query: { organizationId: currentOrg.id }
      })
      if (invitationsResponse.data?.length) {
        setInvitations(invitationsResponse.data)
      }
    } catch (error) {
      console.error('Failed to load organization details:', error)
      toast.error('Failed to load organization details')
    } finally {
      setLoadingMembers(false)
    }
  }

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
    const colors = {
      owner: 'bg-yellow-100 text-yellow-800',
      admin: 'bg-blue-100 text-blue-800',
      member: 'bg-gray-100 text-gray-800',
    }
    return (
      <Badge className={`text-xs ${colors[roleStr?.toLowerCase() as keyof typeof colors] || colors.member}`}>
        {roleStr}
      </Badge>
    )
  }

  const handleInviteUser = async () => {
    if (!currentOrg?.id) return
    // This would typically open an invite dialog
    toast.info('Invite dialog would open here')
  }

  const handleCreateOrganization = async () => {
    if (!createForm.name.trim()) {
      toast.error('Organization name is required')
      return
    }
    
    try {
      setCreating(true)
      const result = await organizationAPI.create({
        name: createForm.name.trim(),
        slug: createForm.slug.trim() || createForm.name.toLowerCase().replace(/\s+/g, '-'),
      })
      
      if (result.error) {
        toast.error(result.error.message || 'Failed to create organization')
        return
      }
      
      toast.success(`Organization "${createForm.name}" created successfully!`)
      setShowCreateDialog(false)
      setCreateForm({ name: '', slug: '' })
      refetchOrgs()
      
    } catch (error: any) {
      console.error('Failed to create organization:', error)
      toast.error(error?.message || 'Failed to create organization')
    } finally {
      setCreating(false)
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
                onClick={loadOrganizationDetails}
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
                    <CardTitle className="text-base">Organization Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Name:</span>
                      <span className="text-sm font-medium">{currentOrg.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Slug:</span>
                      <span className="text-sm font-mono">{currentOrg.slug}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Created:</span>
                      <span className="text-sm">
                        {new Date(currentOrg.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Members Section */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Members ({members.length})
                      </CardTitle>
                      <Button size="sm" onClick={handleInviteUser}>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Invite
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loadingMembers ? (
                      <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {members.map((member) => (
                          <div key={member.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={member.user?.image} />
                                <AvatarFallback>
                                  {member.user?.name?.charAt(0) || member.user?.email?.charAt(0) || 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="text-sm font-medium">
                                  {member.user?.name || member.user?.email}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {member.user?.email}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {getRoleBadge(member.role)}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
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
                        <Mail className="h-4 w-4" />
                        Pending Invitations ({invitations.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {invitations.map((invitation) => (
                          <div key={invitation.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                                <Mail className="h-4 w-4 text-gray-500" />
                              </div>
                              <div>
                                <div className="text-sm font-medium">{invitation.email}</div>
                                <div className="text-xs text-gray-500">
                                  Invited by {invitation.inviter?.user?.name || invitation.inviter?.user?.email}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {getRoleBadge(invitation.role)}
                              <Badge variant="outline" className="text-xs">
                                Pending
                              </Badge>
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
            <div className="text-sm font-semibold text-blue-700">{members.length}</div>
            <div className="text-xs text-blue-600">Members</div>
          </div>
          <div className="p-2 bg-purple-50 rounded-md">
            <div className="text-sm font-semibold text-purple-700">{invitations.length}</div>
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
          onClick={handleInviteUser}
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