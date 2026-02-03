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
import { Badge } from '@/ui-components/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui-components/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui-components/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/ui-components/dropdown-menu'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/ui-components/tabs'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/ui-components/card'
import { Separator } from '@/ui-components/separator'
import {
  UserPlus,
  Mail,
  Send,
  Users,
  Clock,
  MoreHorizontal,
  Trash2,
  Crown,
  Shield,
  User as UserIcon,
  CheckCircle2,
  Loader2,
  X,
  Building2,
  Settings,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { organizationAPI, useSession } from '@/lib/better-auth-client'

interface WorkspaceSettingsPanelProps {
  isOpen: boolean
  onClose: () => void
  workspaceId: string  // Better Auth organization ID
  workspaceName: string
}

type MemberRole = 'owner' | 'admin' | 'editor' | 'viewer' | 'member'

interface WorkspaceMemberWithAuth {
  id: string
  workspace_id: string
  ba_user_id: string
  role: MemberRole
  created_at: string
  updated_at: string
  user_name: string
  user_email: string
  user_image: string | null
  user_email_verified: boolean
  user_created_at: string
}

interface WorkspaceInvitationData {
  id: string
  workspace_id: string
  email: string
  role: MemberRole
  status: string
  expires_at: string
  created_at: string
  invited_by_user_id: string | null
  inviter_name: string | null
  inviter_email: string | null
}

const ROLE_OPTIONS: { value: MemberRole; label: string; icon: any }[] = [
  { value: 'owner', label: 'Owner', icon: Crown },
  { value: 'admin', label: 'Admin', icon: Shield },
  { value: 'member', label: 'Member', icon: UserIcon },
  { value: 'viewer', label: 'Viewer', icon: UserIcon },
]

export function WorkspaceSettingsPanel({
  isOpen,
  onClose,
  workspaceId,
  workspaceName,
}: WorkspaceSettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<'organization' | 'profile'>('organization')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<MemberRole>('member')
  const [isSending, setIsSending] = useState(false)
  
  const [members, setMembers] = useState<WorkspaceMemberWithAuth[]>([])
  const [invitations, setInvitations] = useState<WorkspaceInvitationData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  const { data: session } = useSession()

  // Load workspace members and invitations
  const loadData = async () => {
    if (!workspaceId) return
    
    setIsLoading(true)
    try {
      console.log('Loading data for workspace (BA Org ID):', workspaceId)
      
      // Load members using Better Auth organization API
      const membersResponse = await organizationAPI.listMembers({ 
        query: { organizationId: workspaceId } 
      })
      
      console.log('Members response:', membersResponse)
      
      if (membersResponse.data) {
        const membersArray = Array.isArray(membersResponse.data) 
          ? membersResponse.data 
          : (membersResponse.data as any).members || []
        
        console.log('Members array:', membersArray)
        
        // Map to the format expected by the UI
        const mappedMembers = membersArray.map((m: any) => ({
          id: m.id,
          workspace_id: workspaceId,
          ba_user_id: m.userId,
          role: m.role,
          created_at: m.createdAt,
          updated_at: m.createdAt,
          user_name: m.user?.name || m.email,
          user_email: m.user?.email || m.email,
          user_image: m.user?.image || null,
          user_email_verified: m.user?.emailVerified || true,
          user_created_at: m.createdAt
        }))
        console.log('Mapped members:', mappedMembers)
        setMembers(mappedMembers)
      }

      // Load pending invitations using Better Auth organization API
      const invitationsResponse = await organizationAPI.listInvitations({ 
        query: { organizationId: workspaceId } 
      })
      
      console.log('Invitations response:', invitationsResponse)
      
      if (invitationsResponse.data) {
        const invitationsArray = Array.isArray(invitationsResponse.data)
          ? invitationsResponse.data
          : []
        
        console.log('Invitations array:', invitationsArray)
        
        // Map to the format expected by the UI
        const mappedInvitations = invitationsArray
          .filter((inv: any) => inv.status === 'pending')
          .map((inv: any) => ({
            id: inv.id,
            workspace_id: workspaceId,
            email: inv.email,
            role: inv.role,
            status: inv.status,
            expires_at: inv.expiresAt,
            created_at: inv.createdAt,
            invited_by_user_id: inv.inviterId,
            inviter_name: null,
            inviter_email: null
          }))
        console.log('Mapped invitations:', mappedInvitations)
        setInvitations(mappedInvitations)
      }
    } catch (error) {
      console.error('Failed to load data:', error)
      toast.error('Failed to load workspace data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen, workspaceId])

  const handleSendInvite = async () => {
    if (!email.trim()) {
      toast.error('Email is required')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address')
      return
    }

    setIsSending(true)
    try {
      // Better Auth only supports owner, admin, member roles
      const validRole = (role === 'editor' || role === 'viewer' ? 'member' : role) as 'owner' | 'admin' | 'member'
      
      await organizationAPI.inviteMember({
        organizationId: workspaceId,
        email,
        role: validRole
      })
      
      toast.success(`Invitation sent to ${email}`)
      setEmail('')
      setRole('member')
      await loadData()
    } catch (error: any) {
      console.error('Failed to send invitation:', error)
      toast.error(error?.message || 'Failed to send invitation')
    } finally {
      setIsSending(false)
    }
  }

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    try {
      await organizationAPI.removeMember({
        organizationId: workspaceId,
        memberIdOrEmail: memberId
      })
      
      toast.success(`Removed ${memberName}`)
      await loadData()
    } catch (error) {
      console.error('Failed to remove member:', error)
      toast.error('Failed to remove member')
    }
  }

  const handleUpdateRole = async (memberId: string, newRole: MemberRole) => {
    try {
      // Better Auth only supports owner, admin, member roles
      const validRole = newRole === 'editor' || newRole === 'viewer' ? 'member' : newRole
      
      await organizationAPI.updateMemberRole({
        organizationId: workspaceId,
        memberId: memberId,
        role: validRole as 'owner' | 'admin' | 'member'
      })
      
      toast.success('Role updated')
      await loadData()
    } catch (error) {
      console.error('Failed to update role:', error)
      toast.error('Failed to update role')
    }
  }

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      await organizationAPI.cancelInvitation({
        invitationId
      })
      
      toast.success('Invitation cancelled')
      await loadData()
    } catch (error) {
      console.error('Failed to cancel invitation:', error)
      toast.error('Failed to cancel invitation')
    }
  }

  const handleResendInvitation = async (invitationId: string, email: string) => {
    try {
      const invitation = invitations.find(i => i.id === invitationId)
      const inviteRole = invitation?.role || 'member'
      // Better Auth only supports owner, admin, member roles
      const validRole = (inviteRole === 'editor' || inviteRole === 'viewer' ? 'member' : inviteRole) as 'owner' | 'admin' | 'member'
      
      // Cancel and resend (Better Auth doesn't have a direct resend method)
      await organizationAPI.cancelInvitation({ invitationId })
      await organizationAPI.inviteMember({
        organizationId: workspaceId,
        email,
        role: validRole
      })
      
      toast.success(`Invitation resent to ${email}`)
      await loadData()
    } catch (error) {
      console.error('Failed to resend invitation:', error)
      toast.error('Failed to resend invitation')
    }
  }

  const getRoleBadge = (role: MemberRole) => {
    const config = {
      owner: { label: 'Owner', className: 'bg-gradient-to-r from-yellow-500 to-amber-600 text-white border-none' },
      admin: { label: 'Admin', className: 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-none' },
      member: { label: 'Member', className: 'bg-gray-100 text-gray-700 border-gray-200' },
      editor: { label: 'Editor', className: 'bg-green-100 text-green-700 border-green-200' },
      viewer: { label: 'Viewer', className: 'bg-gray-100 text-gray-600 border-gray-200' },
    }
    
    const { label, className } = config[role]
    
    return (
      <Badge variant="outline" className={cn('text-xs font-medium', className)}>
        {label}
      </Badge>
    )
  }

  const getRoleIcon = (role: MemberRole) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4 text-yellow-600" />
      case 'admin':
        return <Shield className="h-4 w-4 text-blue-600" />
      default:
        return <UserIcon className="h-4 w-4 text-gray-500" />
    }
  }

  const stats = {
    totalMembers: members.length,
    pendingInvitations: invitations.length,
    owners: members.filter(m => m.role === 'owner').length,
    admins: members.filter(m => m.role === 'admin').length,
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <SheetTitle>{workspaceName}</SheetTitle>
              <SheetDescription>
                Manage workspace settings and members
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="organization" className="gap-2">
              <Building2 className="h-4 w-4" />
              Organization
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-2">
              <UserIcon className="h-4 w-4" />
              Profile
            </TabsTrigger>
          </TabsList>

          {/* Organization Tab */}
          <TabsContent value="organization" className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-blue-700">{stats.totalMembers}</div>
                  <div className="text-xs text-blue-600 font-medium">Total Members</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-amber-700">{stats.pendingInvitations}</div>
                  <div className="text-xs text-amber-600 font-medium">Pending</div>
                </CardContent>
              </Card>
            </div>

            {/* Organization Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Workspace Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm text-gray-600">Workspace Name</span>
                    <span className="text-sm font-semibold">{workspaceName}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm text-gray-600">Organization ID</span>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono truncate max-w-[200px]" title={workspaceId}>
                      {workspaceId?.substring(0, 12)}...
                    </code>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Invite Member Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Invite Member
                </CardTitle>
                <CardDescription className="text-xs">
                  Send an invitation to join {workspaceName}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email Address</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="colleague@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isSending) {
                        handleSendInvite()
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role-select">Role</Label>
                  <Select value={role} onValueChange={(value) => setRole(value as MemberRole)}>
                    <SelectTrigger id="role-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-2">
                            <opt.icon className="h-4 w-4" />
                            {opt.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    {role === 'admin' && 'Admins can manage members and workspace settings'}
                    {role === 'member' && 'Members can access workspace content'}
                    {role === 'viewer' && 'Viewers have read-only access'}
                    {role === 'owner' && 'Owners have full control over the workspace'}
                  </p>
                </div>
                <Button onClick={handleSendInvite} disabled={isSending} className="w-full">
                  {isSending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Invitation
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Members Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Members ({stats.totalMembers})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                  </div>
                ) : members.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No members yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {members.map((member) => (
                      <div key={member.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Avatar className="h-10 w-10 border-2 border-gray-100">
                            <AvatarImage src={member.user_image || undefined} />
                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-sm font-medium">
                              {member.user_name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase() || 
                               member.user_email.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">{member.user_name}</span>
                              {member.ba_user_id === session?.user?.id && (
                                <Badge variant="outline" className="text-xs">You</Badge>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 truncate">{member.user_email}</div>
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
                          {member.ba_user_id !== session?.user?.id && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleUpdateRole(member.id, 'admin')}>
                                  Make Admin
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleUpdateRole(member.id, 'member')}>
                                  Make Member
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-red-600"
                                  onClick={() => handleRemoveMember(member.id, member.user_name)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Remove Member
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
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
                      <div key={invitation.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <Mail className="h-5 w-5 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{invitation.email}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              <span>Role:</span>
                              <span className="font-medium">{invitation.role}</span>
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              Sent {new Date(invitation.created_at).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit'
                              })}
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
                                onClick={() => handleResendInvitation(invitation.id, invitation.email)}
                              >
                                <Send className="h-4 w-4 mr-2" />
                                Resend Invitation
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-red-600"
                                onClick={() => handleCancelInvitation(invitation.id)}
                              >
                                <X className="h-4 w-4 mr-2" />
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
          </TabsContent>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <UserIcon className="h-4 w-4" />
                  Your Profile
                </CardTitle>
                <CardDescription className="text-xs">
                  Manage your personal profile settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {session?.user && (
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16 border-2 border-gray-200">
                      <AvatarImage src={session.user.image || undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-lg font-medium">
                        {session.user.name?.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase() || 
                         session.user.email?.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-base font-semibold">{session.user.name}</div>
                      <div className="text-sm text-gray-600">{session.user.email}</div>
                      {session.user.emailVerified && (
                        <div className="flex items-center gap-1 text-xs text-green-600 mt-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Email verified
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <Separator />

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="profile-name">Display Name</Label>
                    <Input
                      id="profile-name"
                      defaultValue={session?.user?.name || ''}
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="profile-email">Email Address</Label>
                    <Input
                      id="profile-email"
                      type="email"
                      defaultValue={session?.user?.email || ''}
                      disabled
                      className="bg-gray-50"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Email cannot be changed
                    </p>
                  </div>
                </div>

                <Button className="w-full" variant="outline" disabled>
                  Save Profile Changes
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Account Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start" disabled>
                  <Settings className="h-4 w-4 mr-2" />
                  Change Password
                </Button>
                <Button variant="outline" className="w-full justify-start text-red-600" disabled>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Account
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
