"use client"

import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/ui-components/sheet'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/ui-components/tabs'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/ui-components/table'
import { Badge } from '@/ui-components/badge'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { LoadingSwap } from '@/components/ui/loading-swap'
import { ActionButton } from '@/components/ui/action-button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui-components/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui-components/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/ui-components/form'
import { UserPlus, Loader2 } from 'lucide-react'
import { useSession } from '@/auth/client/main'
import { membersClient, invitationsClient } from '@/lib/api/invitations-client'
import type { WorkspaceMemberWithAuth, WorkspaceInvitation, MemberRole } from '@/types/workspaces'
import { toast } from 'sonner'

interface OrganizationMembersSheetProps {
  isOpen: boolean
  onClose: () => void
  workspaceId: string
  workspaceName: string
}

const roleBadgeVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  owner: 'default',
  admin: 'secondary',
  editor: 'outline',
  viewer: 'outline',
}

const ASSIGNABLE_ROLES: MemberRole[] = ['admin', 'editor', 'viewer']

export function OrganizationMembersSheet({ isOpen, onClose, workspaceId, workspaceName }: OrganizationMembersSheetProps) {
  const { data: session } = useSession()
  const [members, setMembers] = useState<WorkspaceMemberWithAuth[]>([])
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)

  const loadData = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    try {
      const [membersRes, invitationsRes] = await Promise.all([
        membersClient.listWithAuth(workspaceId),
        invitationsClient.listForWorkspace(workspaceId),
      ])
      setMembers(membersRes ?? [])
      setInvitations(invitationsRes ?? [])
    } catch (error) {
      console.error('Failed to load workspace members:', error)
      toast.error('Failed to load members')
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    if (isOpen) loadData()
  }, [isOpen, loadData])

  const pendingInvitations = invitations.filter((i) => i.status === 'pending')

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <SheetTitle className="text-lg">{workspaceName}</SheetTitle>
              <SheetDescription className="text-sm text-gray-500">Manage members and invitations</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="p-6 flex-1 overflow-y-auto">
            <Tabs defaultValue="members">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="members">Members</TabsTrigger>
                <TabsTrigger value="invitations">Invitations</TabsTrigger>
              </TabsList>

              <TabsContent value="members" className="mt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => {
                      const isSelf = !!session?.user?.id && member.ba_user_id === session.user.id
                      return (
                        <TableRow key={member.id}>
                          <TableCell>{member.user_name || 'Unnamed'}</TableCell>
                          <TableCell>{member.user_email}</TableCell>
                          <TableCell>
                            {member.role === 'owner' ? (
                              <Badge variant={roleBadgeVariant.owner}>owner</Badge>
                            ) : (
                              <Select
                                value={member.role}
                                onValueChange={async (role) => {
                                  try {
                                    await membersClient.update(member.id, { role: role as MemberRole })
                                    await loadData()
                                  } catch (error: any) {
                                    toast.error(error?.message || 'Failed to update role')
                                  }
                                }}
                              >
                                <SelectTrigger className="w-28">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ASSIGNABLE_ROLES.map((role) => (
                                    <SelectItem key={role} value={role}>{role}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {!isSelf && member.role !== 'owner' && (
                              <ActionButton
                                variant="ghost"
                                size="sm"
                                requireAreYouSure
                                areYouSureDescription={`Remove ${member.user_name || member.user_email} from ${workspaceName}?`}
                                successMessage="Member removed"
                                action={async () => {
                                  try {
                                    await membersClient.remove(member.id)
                                    await loadData()
                                    return { error: false }
                                  } catch (error: any) {
                                    return { error: true, message: error?.message || 'Failed to remove member' }
                                  }
                                }}
                              >
                                Remove
                              </ActionButton>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="invitations" className="mt-6 space-y-4">
                <div className="flex justify-end">
                  <InviteMemberDialog
                    open={inviteOpen}
                    onOpenChange={setInviteOpen}
                    workspaceId={workspaceId}
                    onInvited={loadData}
                  />
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingInvitations.map((invitation) => (
                      <TableRow key={invitation.id}>
                        <TableCell>{invitation.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{invitation.role}</Badge>
                        </TableCell>
                        <TableCell>{new Date(invitation.expires_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <ActionButton
                            variant="ghost"
                            size="sm"
                            successMessage="Invitation cancelled"
                            action={async () => {
                              try {
                                await invitationsClient.revoke(invitation.id)
                                await loadData()
                                return { error: false }
                              } catch (error: any) {
                                return { error: true, message: error?.message || 'Failed to cancel invitation' }
                              }
                            }}
                          >
                            Cancel
                          </ActionButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    {pendingInvitations.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                          No pending invitations
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

const inviteSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  role: z.enum(['editor', 'viewer', 'admin']),
})

type InviteForm = z.infer<typeof inviteSchema>

function InviteMemberDialog({
  open,
  onOpenChange,
  workspaceId,
  onInvited,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  onInvited: () => void
}) {
  const form = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', role: 'editor' },
  })
  const { isSubmitting } = form.formState

  async function handleSubmit(data: InviteForm) {
    try {
      await invitationsClient.createForWorkspace(workspaceId, { email: data.email, role: data.role })
      toast.success('Invitation sent')
      form.reset()
      onOpenChange(false)
      onInvited()
    } catch (error: any) {
      toast.error(error?.message || 'Failed to invite member')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4 mr-2" />
          Invite member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite member</DialogTitle>
          <DialogDescription>Send an invitation to join this workspace.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ASSIGNABLE_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>{role}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                <LoadingSwap isLoading={isSubmitting}>Invite</LoadingSwap>
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
