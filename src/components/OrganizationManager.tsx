'use client'

import { useState } from 'react'
import { useSession } from '@/lib/better-auth-client'
import { organizationAPI, useListOrganizations, useActiveOrganization } from '@/lib/better-auth-client'
import { Button } from '@/ui-components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui-components/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/ui-components/dialog'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui-components/select'
import { Badge } from '@/ui-components/badge'
import { Loader2, Plus, Users, Mail, Crown, Shield, User } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Organization {
  id: string
  name: string
  slug: string
  description?: string
  logo?: string | null
  createdAt: string | Date
  metadata?: any
}

interface Member {
  id: string
  user: {
    id: string
    name?: string
    email: string
  }
  role: string | string[]
  joinedAt?: string
}

interface Invitation {
  id: string
  email: string
  role: string | string[]
  status: string
  expiresAt?: string
  inviter: {
    user: {
      name?: string
      email: string
    }
  }
}

function getRoleIcon(role: string | string[]) {
  const primaryRole = Array.isArray(role) ? role[0] : role
  switch (primaryRole?.toLowerCase()) {
    case 'owner':
      return <Crown className="h-4 w-4 text-yellow-600" />
    case 'admin':
      return <Shield className="h-4 w-4 text-blue-600" />
    default:
      return <User className="h-4 w-4 text-gray-600" />
  }
}

function getRoleBadgeVariant(role: string | string[]): "default" | "secondary" | "outline" {
  const primaryRole = Array.isArray(role) ? role[0] : role
  switch (primaryRole?.toLowerCase()) {
    case 'owner':
      return 'default'
    case 'admin':
      return 'secondary'
    default:
      return 'outline'
  }
}

export function OrganizationManager() {
  const { data: session } = useSession()
  const { data: organizations, isPending: organizationsLoading, refetch: refetchOrganizations } = useListOrganizations()
  const { data: activeOrg } = useActiveOrganization()
  
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [loadingInvitations, setLoadingInvitations] = useState(false)
  
  // Create organization state
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', description: '' })
  const [creating, setCreating] = useState(false)
  
  // Invite member state
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'member' })
  const [inviting, setInviting] = useState(false)

  async function loadOrganizationData(orgId: string) {
    setSelectedOrgId(orgId)
    
    // Load members
    setLoadingMembers(true)
    try {
      const membersResult = await organizationAPI.listMembers({
        query: { organizationId: orgId }
      })
      if (membersResult.data?.members) {
        setMembers(membersResult.data.members)
      }
    } catch (error) {
      console.error('Failed to load members:', error)
      toast.error('Failed to load organization members')
    } finally {
      setLoadingMembers(false)
    }
    
    // Load invitations
    setLoadingInvitations(true)
    try {
      const invitationsResult = await organizationAPI.listInvitations({
        query: { organizationId: orgId }
      })
      if (invitationsResult.data?.length) {
        setInvitations(invitationsResult.data.map((inv: any) => ({
          ...inv,
          inviter: {
            user: {
              name: inv.inviter?.user?.name || 'Unknown',
              email: inv.inviter?.user?.email || 'Unknown'
            }
          }
        })))
      }
    } catch (error) {
      console.error('Failed to load invitations:', error)
      toast.error('Failed to load invitations')
    } finally {
      setLoadingInvitations(false)
    }
  }

  async function createOrganization() {
    if (!createForm.name.trim()) {
      toast.error('Organization name is required')
      return
    }
    
    try {
      setCreating(true)
      const result = await organizationAPI.create({
        name: createForm.name.trim(),
        slug: createForm.name.toLowerCase().replace(/\s+/g, '-'),
        // Note: Better Auth organization plugin may not support description field
        // Remove this line if it causes errors
        // description: createForm.description.trim() || undefined,
      })
      
      if (result.error) {
        toast.error(result.error.message || 'Failed to create organization')
        return
      }
      
      toast.success(`Organization "${createForm.name}" created successfully!`)
      setShowCreateDialog(false)
      setCreateForm({ name: '', description: '' })
      refetchOrganizations()
      
    } catch (error: any) {
      console.error('Failed to create organization:', error)
      toast.error(error?.message || 'Failed to create organization')
    } finally {
      setCreating(false)
    }
  }

  async function inviteMember() {
    if (!selectedOrgId || !inviteForm.email.trim()) {
      toast.error('Email is required')
      return
    }
    
    try {
      setInviting(true)
      const result = await organizationAPI.inviteMember({
        email: inviteForm.email.trim(),
        role: inviteForm.role as 'member' | 'admin' | 'owner',
        organizationId: selectedOrgId,
      })
      
      if (result.error) {
        toast.error(result.error.message || 'Failed to send invitation')
        return
      }
      
      toast.success(`Invitation sent to ${inviteForm.email}!`)
      setShowInviteDialog(false)
      setInviteForm({ email: '', role: 'member' })
      
      // Reload invitations
      loadOrganizationData(selectedOrgId)
      
    } catch (error: any) {
      console.error('Failed to invite member:', error)
      toast.error(error?.message || 'Failed to send invitation')
    } finally {
      setInviting(false)
    }
  }

  async function setActiveOrganization(orgId: string) {
    try {
      const result = await organizationAPI.setActive({
        organizationId: orgId
      })
      
      if (result.error) {
        toast.error(result.error.message || 'Failed to set active organization')
        return
      }
      
      toast.success('Active organization updated!')
      
    } catch (error: any) {
      console.error('Failed to set active organization:', error)
      toast.error(error?.message || 'Failed to update active organization')
    }
  }

  if (!session) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <p className="text-gray-500">Please sign in to manage organizations</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Organizations</h2>
          <p className="text-gray-600">Manage your organizations and team members</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Organization
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Organization</DialogTitle>
              <DialogDescription>
                Create a new organization to collaborate with your team.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="org-name">Organization Name</Label>
                <Input
                  id="org-name"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="Enter organization name"
                />
              </div>
              <div>
                <Label htmlFor="org-description">Description (Optional)</Label>
                <Input
                  id="org-description"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="Enter organization description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={createOrganization} disabled={creating}>
                {creating ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</>
                ) : (
                  'Create Organization'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Organizations List */}
      {organizationsLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center p-6">
            <div className="flex items-center space-x-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading organizations...</span>
            </div>
          </CardContent>
        </Card>
      ) : organizations && organizations.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {organizations.map((org: Organization) => (
            <Card 
              key={org.id} 
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                activeOrg?.id === org.id && "ring-2 ring-blue-500"
              )}
              onClick={() => loadOrganizationData(org.id)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{org.name}</CardTitle>
                  {activeOrg?.id === org.id && (
                    <Badge variant="default">Active</Badge>
                  )}
                </div>
                {org.metadata?.description && (
                  <CardDescription>{org.metadata.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    Created {new Date(org.createdAt).toLocaleDateString()}
                  </span>
                  {activeOrg?.id !== org.id && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveOrganization(org.id)
                      }}
                    >
                      Set Active
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12">
            <Users className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Organizations</h3>
            <p className="text-gray-500 text-center mb-4">
              You don&apos;t belong to any organizations yet. Create one to get started.
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Organization
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Organization Details */}
      {selectedOrgId && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Members */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <CardTitle>Members</CardTitle>
                </div>
                <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Mail className="mr-2 h-4 w-4" />
                      Invite
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Invite Team Member</DialogTitle>
                      <DialogDescription>
                        Send an invitation to join this organization.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="invite-email">Email Address</Label>
                        <Input
                          id="invite-email"
                          type="email"
                          value={inviteForm.email}
                          onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                          placeholder="Enter email address"
                        />
                      </div>
                      <div>
                        <Label htmlFor="invite-role">Role</Label>
                        <Select
                          value={inviteForm.role}
                          onValueChange={(value) => setInviteForm({ ...inviteForm, role: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
                        Cancel
                      </Button>
                      <Button onClick={inviteMember} disabled={inviting}>
                        {inviting ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</>
                        ) : (
                          'Send Invitation'
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {loadingMembers ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : members.length > 0 ? (
                <div className="space-y-3">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center space-x-3">
                        {getRoleIcon(member.role)}
                        <div>
                          <p className="font-medium">
                            {member.user.name || member.user.email}
                          </p>
                          {member.user.name && (
                            <p className="text-sm text-gray-500">{member.user.email}</p>
                          )}
                        </div>
                      </div>
                      <Badge variant={getRoleBadgeVariant(member.role)}>
                        {Array.isArray(member.role) ? member.role.join(', ') : member.role}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No members found</p>
              )}
            </CardContent>
          </Card>

          {/* Pending Invitations */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Mail className="h-5 w-5" />
                <CardTitle>Pending Invitations</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {loadingInvitations ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : invitations.filter(inv => inv.status === 'pending').length > 0 ? (
                <div className="space-y-3">
                  {invitations
                    .filter(inv => inv.status === 'pending')
                    .map((invitation) => (
                    <div key={invitation.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium">{invitation.email}</p>
                        <p className="text-sm text-gray-500">
                          Invited by {invitation.inviter.user.name || invitation.inviter.user.email}
                        </p>
                        {invitation.expiresAt && (
                          <p className="text-xs text-gray-400">
                            Expires: {new Date(invitation.expiresAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">
                          {Array.isArray(invitation.role) ? invitation.role.join(', ') : invitation.role}
                        </Badge>
                        <Badge variant="secondary">Pending</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No pending invitations</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}