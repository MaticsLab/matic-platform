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
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { goFetch } from '@/lib/api/go-client'

interface InviteToWorkspaceSidebarV2Props {
  isOpen: boolean
  onClose: () => void
  workspaceId: string
  workspaceName: string
}

type MemberRole = 'owner' | 'admin' | 'editor' | 'viewer'

interface WorkspaceMemberWithAuth {
  id: string
  workspace_id: string
  ba_user_id: string
  role: MemberRole
  created_at: string
  updated_at: string
  // From ba_users join
  user_name: string | null
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
  status: 'pending' | 'accepted' | 'rejected'
  expires_at: string | null
  created_at: string
  invited_by_user_id: string | null
  inviter_name: string | null
  inviter_email: string | null
}

const ROLE_OPTIONS: { value: MemberRole; label: string; icon: any }[] = [
  { value: 'owner', label: 'Owner', icon: Crown },
  { value: 'admin', label: 'Admin', icon: Shield },
  { value: 'editor', label: 'Editor', icon: UserIcon },
  { value: 'viewer', label: 'Viewer', icon: UserIcon },
]

export function InviteToWorkspaceSidebarV2({
  isOpen,
  onClose,
  workspaceId,
  workspaceName,
}: InviteToWorkspaceSidebarV2Props) {
  const [activeTab, setActiveTab] = useState<'invite' | 'members' | 'pending'>('members')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<MemberRole>('viewer')
  const [isSending, setIsSending] = useState(false)
  
  const [members, setMembers] = useState<WorkspaceMemberWithAuth[]>([])
  const [invitations, setInvitations] = useState<WorkspaceInvitationData[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load workspace members and invitations
  const loadData = async () => {
    if (!workspaceId) return
    
    setIsLoading(true)
    try {
      // Load members with Better Auth user data
      const membersResult = await goFetch<WorkspaceMemberWithAuth[]>(
        `/workspaces/${workspaceId}/members-with-auth`
      )
      if (membersResult) {
        setMembers(membersResult)
      }

      // Load pending invitations with inviter data
      const invitationsResult = await goFetch<WorkspaceInvitationData[]>(
        `/workspaces/${workspaceId}/invitations?status=pending`
      )
      if (invitationsResult) {
        setInvitations(invitationsResult)
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
      await goFetch(`/workspaces/${workspaceId}/invitations`, {
        method: 'POST',
        body: JSON.stringify({ email, role })
      })
      
      toast.success(`Invitation sent to ${email}`)
      setEmail('')
      setRole('viewer')
      await loadData()
      setActiveTab('pending')
    } catch (error: any) {
      console.error('Failed to send invitation:', error)
      toast.error(error?.message || 'Failed to send invitation')
    } finally {
      setIsSending(false)
    }
  }

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    try {
      await goFetch(`/workspace-members/${memberId}`, {
        method: 'DELETE'
      })
      
      toast.success(`Removed ${memberName}`)
      await loadData()
    } catch (error) {
      toast.error('Failed to remove member')
    }
  }

  const handleUpdateRole = async (memberId: string, newRole: MemberRole) => {
    try {
      await goFetch(`/workspace-members/${memberId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole })
      })
      
      toast.success('Role updated')
      await loadData()
    } catch (error) {
      toast.error('Failed to update role')
    }
  }

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      await goFetch(`/workspace-invitations/${invitationId}`, {
        method: 'DELETE'
      })
      
      toast.success('Invitation cancelled')
      await loadData()
    } catch (error) {
      toast.error('Failed to cancel invitation')
    }
  }

  const getRoleBadge = (role: MemberRole) => {
    const config = {
      owner: { label: 'Owner', className: 'bg-purple-100 text-purple-700 border-purple-200' },
      admin: { label: 'Admin', className: 'bg-blue-100 text-blue-700 border-blue-200' },
      editor: { label: 'Editor', className: 'bg-green-100 text-green-700 border-green-200' },
      viewer: { label: 'Viewer', className: 'bg-gray-100 text-gray-700 border-gray-200' },
    }
    
    const { label, className } = config[role]
    
    return (
      <Badge variant="outline" className={cn('text-xs px-2 py-0.5', className)}>
        {label}
      </Badge>
    )
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col h-full">
        {/* Fixed Header */}
        <SheetHeader className="px-6 py-4 border-b bg-white flex-shrink-0">
          <SheetTitle className="text-lg font-semibold text-gray-900">
            Team
          </SheetTitle>
          <SheetDescription className="text-sm text-gray-500">
            Manage members and invitations for {workspaceName}
          </SheetDescription>
        </SheetHeader>

        {/* Tabs */}
        <div className="flex border-b px-4 flex-shrink-0 bg-white">
          <button
            onClick={() => setActiveTab('invite')}
            className={cn(
              'flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === 'invite'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            )}
          >
            <UserPlus className="w-4 h-4" />
            Invite
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={cn(
              'flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === 'members'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            )}
          >
            <Users className="w-4 h-4" />
            Members
            {members.length > 0 && (
              <span className={cn(
                'ml-1 px-1.5 py-0.5 text-xs rounded-md font-medium',
                activeTab === 'members' ? 'bg-gray-100 text-gray-700' : 'bg-gray-50 text-gray-500'
              )}>
                {members.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={cn(
              'flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === 'pending'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            )}
          >
            <Clock className="w-4 h-4" />
            Pending
            {invitations.length > 0 && (
              <span className={cn(
                'ml-1 px-1.5 py-0.5 text-xs rounded-md font-medium',
                activeTab === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-gray-50 text-gray-500'
              )}>
                {invitations.length}
              </span>
            )}
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <>
                {/* Invite Tab */}
                {activeTab === 'invite' && (
                  <div className="space-y-4">
                    <div className="border rounded-lg p-4 bg-white">
                      <h3 className="text-sm font-semibold mb-4 text-gray-900">
                        Invite member by email
                      </h3>
                      
                      <div className="space-y-3">
                        <div>
                          <Label htmlFor="email" className="text-xs font-medium text-gray-700 mb-1.5 block">
                            Email
                          </Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="name@company.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !isSending) {
                                handleSendInvite()
                              }
                            }}
                            className="h-9 text-sm"
                          />
                        </div>

                        <div>
                          <Label htmlFor="role" className="text-xs font-medium text-gray-700 mb-1.5 block">
                            Role
                          </Label>
                          <Select value={role} onValueChange={(value) => setRole(value as MemberRole)}>
                            <SelectTrigger id="role" className="h-9 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLE_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  <div className="flex items-center gap-2">
                                    <option.icon className="h-3.5 w-3.5" />
                                    {option.label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <Button
                          onClick={handleSendInvite}
                          disabled={isSending}
                          className="w-full h-9 text-sm bg-black hover:bg-gray-800"
                        >
                          {isSending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Sending
                            </>
                          ) : (
                            <>
                              <Send className="h-3.5 w-3.5 mr-2" />
                              Send invite
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <p className="text-xs text-gray-600 leading-relaxed">
                        Invited members will receive an email invitation to join this workspace. 
                        They can accept the invitation to gain access based on their assigned role.
                      </p>
                    </div>
                  </div>
                )}

                {/* Members Tab */}
                {activeTab === 'members' && (
                  <div className="space-y-0 border rounded-lg overflow-hidden bg-white">
                    {members.length === 0 ? (
                      <div className="text-center py-16">
                        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                          <Users className="h-5 w-5 text-gray-400" />
                        </div>
                        <p className="text-sm text-gray-600 font-medium">No members yet</p>
                        <p className="text-xs text-gray-500 mt-1">Invite team members to collaborate</p>
                      </div>
                    ) : (
                      members.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                        >
                          <Avatar className="h-8 w-8 flex-shrink-0">
                            <AvatarImage src={member.user_image || undefined} />
                            <AvatarFallback className="bg-gray-900 text-white text-xs font-medium">
                              {member.user_name
                                ?.split(' ')
                                .map((n) => n[0])
                                .join('')
                                .substring(0, 2)
                                .toUpperCase() ||
                                member.user_email.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium text-gray-900 truncate">
                                {member.user_name || member.user_email}
                              </span>
                              {member.user_email_verified && (
                                <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
                              )}
                            </div>
                            {member.user_name && (
                              <div className="text-xs text-gray-500 truncate">
                                {member.user_email}
                              </div>
                            )}
                          </div>

                          {getRoleBadge(member.role)}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-gray-100">
                                <MoreHorizontal className="h-4 w-4 text-gray-500" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <div className="px-2 py-1.5 text-xs font-medium text-gray-500">
                                Change Role
                              </div>
                              {ROLE_OPTIONS.map((option) => (
                                <DropdownMenuItem
                                  key={option.value}
                                  onClick={() => handleUpdateRole(member.id, option.value)}
                                  disabled={option.value === member.role}
                                  className="text-sm"
                                >
                                  <option.icon className="h-3.5 w-3.5 mr-2" />
                                  {option.label}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleRemoveMember(member.id, member.user_name || member.user_email)}
                                className="text-red-600 focus:text-red-600 text-sm"
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-2" />
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Pending Tab */}
                {activeTab === 'pending' && (
                  <div className="space-y-0 border rounded-lg overflow-hidden bg-white">
                    {invitations.length === 0 ? (
                      <div className="text-center py-16">
                        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                          <Clock className="h-5 w-5 text-gray-400" />
                        </div>
                        <p className="text-sm text-gray-600 font-medium">No pending invitations</p>
                        <p className="text-xs text-gray-500 mt-1">Sent invitations will appear here</p>
                      </div>
                    ) : (
                      invitations.map((invitation) => (
                        <div
                          key={invitation.id}
                          className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                        >
                          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                            <Mail className="h-4 w-4 text-amber-600" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {invitation.email}
                            </div>
                            <div className="text-xs text-gray-500">
                              Invited {formatTimeAgo(invitation.created_at)}
                            </div>
                          </div>

                          {getRoleBadge(invitation.role)}
                          
                          <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50 text-xs">
                            Pending
                          </Badge>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelInvitation(invitation.id)}
                            className="h-7 w-7 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
