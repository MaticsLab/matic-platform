"use client"

import { useState, useEffect, useCallback } from 'react'
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
import { Checkbox } from '@/ui-components/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui-components/select'
import {
  UserPlus,
  Mail,
  Shield,
  Clock,
  X,
  Check,
  Loader2,
  Users,
  Send,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Building2
} from 'lucide-react'
import { invitationsClient, membersClient } from '@/lib/api/invitations-client'
import { listActivitiesHubs } from '@/lib/api/activities-hubs-client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type {
  WorkspaceMember,
  WorkspaceInvitation,
  MemberRole
} from '@/types/workspaces'
import type { ActivitiesHub } from '@/types/activities-hubs'

interface InviteToWorkspaceSidebarProps {
  isOpen: boolean
  onClose: () => void
  workspaceId: string
  workspaceName: string
}

const ROLE_OPTIONS: { value: MemberRole; label: string; description: string }[] = [
  { value: 'admin', label: 'Admin', description: 'Full access to all settings and members' },
  { value: 'editor', label: 'Editor', description: 'Can edit data but not settings' },
  { value: 'viewer', label: 'Viewer', description: 'Can only view data, no editing' },
]

export function InviteToWorkspaceSidebar({
  isOpen,
  onClose,
  workspaceId,
  workspaceName,
}: InviteToWorkspaceSidebarProps) {
  // Form state
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<MemberRole>('viewer')
  const [selectedHubs, setSelectedHubs] = useState<string[]>([])
  const [allHubsAccess, setAllHubsAccess] = useState(true)
  const [isSending, setIsSending] = useState(false)

  // Data state
  const [hubs, setHubs] = useState<ActivitiesHub[]>([])
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // UI state
  const [activeTab, setActiveTab] = useState<'invite' | 'members' | 'pending'>('invite')
  const [expandedSection, setExpandedSection] = useState<'hubs' | null>('hubs')

  // Load data when sidebar opens
  const loadData = useCallback(async () => {
    if (!workspaceId) return

    setIsLoading(true)
    try {
      const [hubsData, membersData, invitationsData] = await Promise.all([
        listActivitiesHubs(workspaceId),
        membersClient.list(workspaceId),
        invitationsClient.list(workspaceId),
      ])

      setHubs(hubsData || [])
      setMembers(membersData || [])
      setInvitations(invitationsData || [])
    } catch (error) {
      console.error('Failed to load data:', error)
      toast.error('Failed to load workspace data')
    } finally {
      setIsLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen, loadData])

  // Reset form when closing
  useEffect(() => {
    if (!isOpen) {
      setEmail('')
      setRole('viewer')
      setSelectedHubs([])
      setAllHubsAccess(true)
      setActiveTab('invite')
    }
  }, [isOpen])

  const handleHubToggle = (hubId: string) => {
    setSelectedHubs((prev) =>
      prev.includes(hubId)
        ? prev.filter((id) => id !== hubId)
        : [...prev, hubId]
    )
  }

  const handleSendInvite = async () => {
    if (!email.trim()) {
      toast.error('Please enter an email address')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Please enter a valid email address')
      return
    }

    setIsSending(true)
    try {
      await invitationsClient.create({
        workspace_id: workspaceId,
        email: email.trim().toLowerCase(),
        role,
        hub_access: allHubsAccess ? [] : selectedHubs,
      })

      toast.success(`Invitation sent to ${email}`)

      // Reset form and refresh
      setEmail('')
      setRole('viewer')
      setSelectedHubs([])
      setAllHubsAccess(true)
      loadData()
      setActiveTab('pending')
    } catch (error: any) {
      console.error('Failed to send invitation:', error)
      toast.error(error.message || 'Failed to send invitation')
    } finally {
      setIsSending(false)
    }
  }

  const handleResendInvitation = async (invitationId: string) => {
    try {
      await invitationsClient.resend(invitationId)
      toast.success('Invitation resent')
      loadData()
    } catch (error: any) {
      toast.error(error.message || 'Failed to resend invitation')
    }
  }

  const handleRevokeInvitation = async (invitationId: string) => {
    try {
      await invitationsClient.revoke(invitationId)
      toast.success('Invitation revoked')
      loadData()
    } catch (error: any) {
      toast.error(error.message || 'Failed to revoke invitation')
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    try {
      await membersClient.remove(memberId)
      toast.success('Member removed')
      loadData()
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove member')
    }
  }

  const handleUpdateMemberRole = async (memberId: string, newRole: MemberRole) => {
    try {
      await membersClient.update(memberId, { role: newRole })
      toast.success('Role updated')
      loadData()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update role')
    }
  }

  const handleUpdateMemberHubAccess = async (memberId: string, hubAccess: string[]) => {
    try {
      await membersClient.update(memberId, { hub_access: hubAccess })
      toast.success('Hub access updated')
      loadData()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update hub access')
    }
  }

  const pendingInvitations = invitations.filter((i) => i.status === 'pending')

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  const formatExpiresIn = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = date.getTime() - now.getTime()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays <= 0) return 'Expired'
    if (diffDays === 1) return 'Expires tomorrow'
    return `Expires in ${diffDays} days`
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <SheetTitle className="flex items-center gap-2 text-lg font-semibold">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-blue-600" />
            </div>
            Invite to Workspace
          </SheetTitle>
          <SheetDescription className="text-sm text-gray-500">
            Invite team members to <span className="font-medium text-gray-700">{workspaceName}</span>
          </SheetDescription>
        </SheetHeader>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6 flex-shrink-0">
          <button
            onClick={() => setActiveTab('invite')}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === 'invite'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            <Send className="w-4 h-4" />
            Invite
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === 'members'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            <Users className="w-4 h-4" />
            Members
            {members.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-100 rounded-full">
                {members.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === 'pending'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            <Clock className="w-4 h-4" />
            Pending
            {pendingInvitations.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full">
                {pendingInvitations.length}
              </span>
            )}
          </button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <>
                {/* Invite Tab */}
                {activeTab === 'invite' && (
                  <div className="space-y-6">
                    {/* Email Input */}
                    <div className="space-y-2">
                      <Label htmlFor="invite-email" className="text-sm font-medium">
                        Email Address
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          id="invite-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="colleague@company.com"
                          className="pl-10"
                        />
                      </div>
                    </div>

                    {/* Role Selection */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Role</Label>
                      <Select value={role} onValueChange={(v) => setRole(v as MemberRole)}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <div className="flex flex-col items-start">
                                <span className="font-medium">{option.label}</span>
                                <span className="text-xs text-gray-500">{option.description}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Separator />

                    {/* Hub Access */}
                    <div className="space-y-3">
                      <button
                        onClick={() => setExpandedSection(expandedSection === 'hubs' ? null : 'hubs')}
                        className="flex items-center justify-between w-full text-left"
                      >
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-gray-500" />
                          <Label className="text-sm font-medium cursor-pointer">Hub Access</Label>
                        </div>
                        {expandedSection === 'hubs' ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </button>

                      {expandedSection === 'hubs' && (
                        <div className="space-y-3 pl-6">
                          {/* All Access Toggle */}
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="all-hubs"
                              checked={allHubsAccess}
                              onCheckedChange={(checked) => {
                                setAllHubsAccess(checked as boolean)
                                if (checked) setSelectedHubs([])
                              }}
                            />
                            <Label htmlFor="all-hubs" className="text-sm cursor-pointer">
                              Access to all hubs
                            </Label>
                          </div>

                          {/* Individual Hub Selection */}
                          {!allHubsAccess && (
                            <div className="space-y-2 mt-3">
                              {hubs.length === 0 ? (
                                <p className="text-sm text-gray-500 italic">
                                  No hubs in this workspace yet
                                </p>
                              ) : (
                                hubs.map((hub) => (
                                  <div
                                    key={hub.id}
                                    className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-50"
                                  >
                                    <Checkbox
                                      id={`hub-${hub.id}`}
                                      checked={selectedHubs.includes(hub.id)}
                                      onCheckedChange={() => handleHubToggle(hub.id)}
                                    />
                                    <Label
                                      htmlFor={`hub-${hub.id}`}
                                      className="flex-1 text-sm cursor-pointer"
                                    >
                                      {hub.name}
                                    </Label>
                                  </div>
                                ))
                              )}

                              {!allHubsAccess && selectedHubs.length === 0 && hubs.length > 0 && (
                                <p className="text-xs text-amber-600 flex items-center gap-1 mt-2">
                                  <AlertCircle className="w-3 h-3" />
                                  Select at least one hub
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Send Button */}
                    <Button
                      onClick={handleSendInvite}
                      disabled={isSending || !email.trim() || (!allHubsAccess && selectedHubs.length === 0)}
                      className="w-full"
                    >
                      {isSending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Send Invitation
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* Members Tab */}
                {activeTab === 'members' && (
                  <div className="space-y-4">
                    {members.length === 0 ? (
                      <div className="text-center py-12">
                        <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No members yet</p>
                      </div>
                    ) : (
                      members.map((member) => (
                        <MemberCard
                          key={member.id}
                          member={member}
                          hubs={hubs}
                          onUpdateRole={handleUpdateMemberRole}
                          onUpdateHubAccess={handleUpdateMemberHubAccess}
                          onRemove={handleRemoveMember}
                        />
                      ))
                    )}
                  </div>
                )}

                {/* Pending Tab */}
                {activeTab === 'pending' && (
                  <div className="space-y-4">
                    {pendingInvitations.length === 0 ? (
                      <div className="text-center py-12">
                        <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No pending invitations</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveTab('invite')}
                          className="mt-4"
                        >
                          <UserPlus className="w-4 h-4 mr-2" />
                          Invite Someone
                        </Button>
                      </div>
                    ) : (
                      pendingInvitations.map((invitation) => (
                        <div
                          key={invitation.id}
                          className="p-4 rounded-xl border border-gray-100 bg-gray-50/50"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                                <Mail className="w-5 h-5 text-amber-600" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">{invitation.email}</p>
                                <p className="text-xs text-gray-500">
                                  {ROLE_OPTIONS.find((r) => r.value === invitation.role)?.label} •{' '}
                                  {formatTimeAgo(invitation.created_at)}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                            <span className="text-xs text-gray-500">
                              {formatExpiresIn(invitation.expires_at)}
                            </span>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleResendInvitation(invitation.id)}
                              >
                                <RefreshCw className="w-3 h-3 mr-1" />
                                Resend
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleRevokeInvitation(invitation.id)}
                              >
                                <X className="w-3 h-3 mr-1" />
                                Revoke
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

// Member Card Component
interface MemberCardProps {
  member: WorkspaceMember
  hubs: ActivitiesHub[]
  onUpdateRole: (memberId: string, role: MemberRole) => void
  onUpdateHubAccess: (memberId: string, hubAccess: string[]) => void
  onRemove: (memberId: string) => void
}

function MemberCard({ member, hubs, onUpdateRole, onUpdateHubAccess, onRemove }: MemberCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedHubs, setSelectedHubs] = useState<string[]>(member.hub_access || [])
  const hasAllAccess = !member.hub_access || member.hub_access.length === 0

  const handleHubToggle = (hubId: string) => {
    const newHubs = selectedHubs.includes(hubId)
      ? selectedHubs.filter((id) => id !== hubId)
      : [...selectedHubs, hubId]
    setSelectedHubs(newHubs)
    onUpdateHubAccess(member.id, newHubs)
  }

  const handleSetAllAccess = () => {
    setSelectedHubs([])
    onUpdateHubAccess(member.id, [])
  }

  return (
    <div className="p-4 rounded-xl border border-gray-100 bg-white">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-medium">
            {member.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div>
            <p className="font-medium text-sm">{member.email || 'Unknown'}</p>
            <p className="text-xs text-gray-500">
              Joined {new Date(member.added_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={member.role}
            onValueChange={(v) => onUpdateRole(member.id, v as MemberRole)}
          >
            <SelectTrigger className="w-24 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
            onClick={() => onRemove(member.id)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Hub Access Section */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 w-full text-left text-xs text-gray-500 hover:text-gray-700"
      >
        <Shield className="w-3 h-3" />
        {hasAllAccess ? 'All hubs' : `${selectedHubs.length} hub${selectedHubs.length !== 1 ? 's' : ''}`}
        {isExpanded ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-2 pl-5">
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`member-${member.id}-all`}
              checked={hasAllAccess}
              onCheckedChange={(checked) => {
                if (checked) {
                  handleSetAllAccess()
                } else {
                  // Uncheck "All hubs" - select all hubs individually to start
                  const allHubIds = hubs.map(h => h.id)
                  setSelectedHubs(allHubIds)
                  onUpdateHubAccess(member.id, allHubIds)
                }
              }}
            />
            <Label htmlFor={`member-${member.id}-all`} className="text-xs cursor-pointer">
              All hubs
            </Label>
          </div>

          {/* Always show hub list when expanded, disabled when hasAllAccess */}
          {hubs.map((hub) => (
            <div key={hub.id} className="flex items-center space-x-2">
              <Checkbox
                id={`member-${member.id}-hub-${hub.id}`}
                checked={hasAllAccess || selectedHubs.includes(hub.id)}
                disabled={hasAllAccess}
                onCheckedChange={() => handleHubToggle(hub.id)}
              />
              <Label
                htmlFor={`member-${member.id}-hub-${hub.id}`}
                className={cn(
                  "text-xs cursor-pointer",
                  hasAllAccess && "text-gray-400"
                )}
              >
                {hub.name}
              </Label>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
