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
import { BetterAuthActionButton } from '@/components/auth/better-auth-action-button'
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
import { organizationAPI, useSession } from '@/auth/client/main'
import { toast } from 'sonner'

interface Member {
  id: string
  userId: string
  role: 'owner' | 'admin' | 'member'
  user: { id: string; name: string; email: string; image?: string | null }
}

interface Invitation {
  id: string
  email: string
  role: string
  status: string
  expiresAt: Date
}

interface OrganizationMembersSheetProps {
  isOpen: boolean
  onClose: () => void
  workspaceId: string
  workspaceName: string
}

const roleBadgeVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  owner: 'default',
  admin: 'secondary',
  member: 'outline',
}

export function OrganizationMembersSheet({ isOpen, onClose, workspaceId, workspaceName }: OrganizationMembersSheetProps) {
  const { data: session } = useSession()
  const [members, setMembers] = useState<Member[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)

  const loadData = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    try {
      const [membersRes, invitationsRes] = await Promise.all([
        organizationAPI.listMembers({ query: { organizationId: workspaceId } }),
        organizationAPI.listInvitations({ query: { organizationId: workspaceId } }),
      ])
      setMembers((membersRes.data?.members as Member[]) ?? [])
      setInvitations((invitationsRes.data as Invitation[]) ?? [])
    } catch (error) {
      console.error('Failed to load organization data:', error)
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
                    {members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>{member.user.name}</TableCell>
                        <TableCell>{member.user.email}</TableCell>
                        <TableCell>
                          {member.role === 'owner' ? (
                            <Badge variant={roleBadgeVariant.owner}>owner</Badge>
                          ) : (
                            <Select
                              value={member.role}
                              onValueChange={async (role) => {
                                const result = await organizationAPI.updateMemberRole({
                                  organizationId: workspaceId,
                                  memberId: member.id,
                                  role: role as 'admin' | 'member',
                                })
                                if (result.error) {
                                  toast.error(result.error.message || 'Failed to update role')
                                  return
                                }
                                loadData()
                              }}
                            >
                              <SelectTrigger className="w-28">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">admin</SelectItem>
                                <SelectItem value="member">member</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {member.userId !== session?.user?.id && member.role !== 'owner' && (
                            <BetterAuthActionButton
                              variant="ghost"
                              size="sm"
                              requireAreYouSure
                              areYouSureDescription={`Remove ${member.user.name} from ${workspaceName}?`}
                              successMessage="Member removed"
                              action={async () => {
                                const result = await organizationAPI.removeMember({
                                  organizationId: workspaceId,
                                  memberIdOrEmail: member.id,
                                })
                                loadData()
                                return result
                              }}
                            >
                              Remove
                            </BetterAuthActionButton>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
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
                        <TableCell>{new Date(invitation.expiresAt).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <BetterAuthActionButton
                            variant="ghost"
                            size="sm"
                            successMessage="Invitation cancelled"
                            action={async () => {
                              const result = await organizationAPI.cancelInvitation({ invitationId: invitation.id })
                              loadData()
                              return result
                            }}
                          >
                            Cancel
                          </BetterAuthActionButton>
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
  role: z.enum(['member', 'admin']),
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
    defaultValues: { email: '', role: 'member' },
  })
  const { isSubmitting } = form.formState

  async function handleSubmit(data: InviteForm) {
    const result = await organizationAPI.inviteMember({
      organizationId: workspaceId,
      email: data.email,
      role: data.role,
    })
    if (result.error) {
      toast.error(result.error.message || 'Failed to invite member')
      return
    }
    toast.success('Invitation sent')
    form.reset()
    onOpenChange(false)
    onInvited()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Member</DialogTitle>
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
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
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
