'use client'

import * as React from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  Home,
  LayoutGrid,
  Users,
  Star,
  Trash2,
  ChevronsUpDown,
  Check,
  User,
  Settings2,
  LogOut,
  Key,
  Lock,
  UserPlus,
  Plus,
  Sparkles,
  Code2,
} from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui-components/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/ui-components/dialog'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { Button } from '@/ui-components/button'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/ui-components/sidebar'
import { Switch } from '@/ui-components/switch'
import ModeToggle from '@/components/mode-toggle'
import { NewWorkspaceModal } from './NewWorkspaceModal'
import { useQuickCreate } from '@/hooks/useQuickCreate'
import {
  useActiveOrganization,
  useListOrganizations,
  organizationAPI,
} from '@/auth/client/main'
import { useOrganizationCreate } from '@/hooks/useOrganizationCreate'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  workspaceId: string
  currentWorkspace?: any
  workspaces?: any[]
  user?: any
  handleWorkspaceSwitch?: (slug: string) => void
  handleSignOut?: () => void
  handleOpenSettings?: () => void
  setShowProfileSidebar?: (open: boolean) => void
  setShowPasswordDialog?: (open: boolean) => void
  setShowApiKeyDialog?: (open: boolean) => void
  setShowInviteSidebar?: (open: boolean) => void
  devMode?: boolean
  setDevMode?: (enabled: boolean) => void
}

export function AppSidebar({
  workspaceId,
  currentWorkspace,
  workspaces = [],
  user,
  handleWorkspaceSwitch,
  handleSignOut,
  handleOpenSettings,
  setShowProfileSidebar,
  setShowPasswordDialog,
  setShowApiKeyDialog,
  setShowInviteSidebar,
  devMode = false,
  setDevMode,
  ...props
}: AppSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { state } = useSidebar()
  const { data: activeOrg } = useActiveOrganization()
  const { data: organizations, refetch: refetchOrgs } = useListOrganizations()
  const { create: createOrg, loading: creatingOrg } = useOrganizationCreate()

  const workspace = currentWorkspace || { id: workspaceId, slug: workspaceId }
  const { handleCreateForm, creatingForm, handleCreateTable, creatingTable } = useQuickCreate({
    workspaceId: workspace.id,
    workspaceSlug: workspace.slug,
  })

  const [showCreateOrgDialog, setShowCreateOrgDialog] = React.useState(false)
  const [createOrgForm, setCreateOrgForm] = React.useState({ name: '', slug: '' })
  const [showNewWorkspaceModal, setShowNewWorkspaceModal] = React.useState(false)
  const [workspacesHover, setWorkspacesHover] = React.useState(false)

  const getDisplayName = (user: any): string => {
    return (
      user?.name ||
      user?.display_name ||
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      (user?.email ? user.email.split('@')[0] : null) ||
      'User'
    )
  }

  const getUserInitials = (user: any): string => {
    const name = getDisplayName(user)
    if (name && name !== 'User') {
      return name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    if (user?.email) return user.email.slice(0, 2).toUpperCase()
    return 'U'
  }

  const navItems = [
    { title: 'Home', icon: Home, slug: 'home', path: '' },
    { title: 'Forms', icon: LayoutGrid, slug: 'applications', path: '/applications' },
    { title: 'CRM', icon: Users, slug: 'crm', path: '/crm' },
    { title: 'Starred', icon: Star, slug: 'starred', path: '/starred' },
    { title: 'Trash', icon: Trash2, slug: 'trash', path: '/trash' },
  ]

  const handleNavClick = (path: string) => {
    router.push(`/workspace/${workspace.slug}${path}`)
  }

  const handleSwitchOrg = async (orgId: string, orgName: string) => {
    try {
      await organizationAPI.setActive({ organizationId: orgId })
      toast.success(`Switched to ${orgName}`)
      refetchOrgs()
    } catch {
      toast.error('Failed to switch organization')
    }
  }

  const handleCreateOrg = async () => {
    const org = await createOrg(createOrgForm.name, createOrgForm.slug)
    if (org) {
      setShowCreateOrgDialog(false)
      setCreateOrgForm({ name: '', slug: '' })
      refetchOrgs()
    }
  }

  return (
    <Sidebar collapsible="icon" variant="inset" className="font-hanken-grotesk" {...props}>
      {/* Header — account / organization switcher */}
      <SidebarHeader>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-2.5 rounded-[11px] border border-transparent bg-transparent p-2 text-left transition-colors hover:bg-[#f1f0ec] group-data-[collapsible=icon]:justify-center">
              <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-[#1f6b3b] text-[17px] font-bold text-white">
                {getUserInitials(user)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate text-[15px] font-bold text-[#1b1b17]">{getDisplayName(user)}</span>
                <span className="truncate text-[12.5px] text-[#8a897f]">{activeOrg?.name || 'No organization'}</span>
              </span>
              <ChevronsUpDown className="ml-auto h-[15px] w-[15px] shrink-0 text-[#a8a79c] group-data-[collapsible=icon]:hidden" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[296px]" side="right" align="start" sideOffset={4}>
            <DropdownMenuLabel className="text-[11px] font-bold uppercase tracking-wide text-[#a8a79c]">
              Organizations
            </DropdownMenuLabel>
            {(organizations || []).map((org: any) => (
              <DropdownMenuItem key={org.id} onClick={() => handleSwitchOrg(org.id, org.name)}>
                <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px] bg-[#eceae4] text-[13px] font-bold text-[#8a897f]">
                  {org.name?.charAt(0).toUpperCase() || '?'}
                </span>
                <span className="min-w-0 flex-1 truncate">{org.name}</span>
                {activeOrg?.id === org.id && <Check className="h-4 w-4 text-[#54534a]" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onClick={() => setShowCreateOrgDialog(true)}>
              <Plus className="h-4 w-4" />
              Create organization
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setShowInviteSidebar?.(true)}>
              <UserPlus className="h-4 w-4" />
              Manage members
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowProfileSidebar?.(true)}>
              <User className="h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowPasswordDialog?.(true)}>
              <Lock className="h-4 w-4" />
              Change password
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowApiKeyDialog?.(true)}>
              <Key className="h-4 w-4" />
              API keys
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleOpenSettings}>
              <Settings2 className="h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-sm">Developer mode</span>
              <Switch checked={devMode} onCheckedChange={setDevMode} />
            </div>
            <div className="px-2 py-1">
              <ModeToggle />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
              <LogOut className="h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          onClick={handleCreateForm}
          disabled={creatingForm || creatingTable}
          className="flex w-full items-center justify-center gap-2 rounded-[11px] bg-[#1b1b17] px-3 py-2.5 text-[14.5px] font-semibold text-white shadow-sm transition-colors hover:bg-black disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          <span className="group-data-[collapsible=icon]:hidden">Create</span>
        </button>
      </SidebarHeader>

      {/* Main navigation */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = item.path
                  ? pathname?.includes(item.path) || false
                  : pathname === `/workspace/${workspace.slug}`
                return (
                  <SidebarMenuItem key={item.slug}>
                    <SidebarMenuButton
                      onClick={() => handleNavClick(item.path)}
                      isActive={isActive}
                      tooltip={item.title}
                      className={cn(isActive && '!bg-[#efeeea] !font-semibold !text-[#1b1b17]')}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <div
            onMouseEnter={() => setWorkspacesHover(true)}
            onMouseLeave={() => setWorkspacesHover(false)}
            className="flex items-center justify-between rounded-md px-2"
          >
            <SidebarGroupLabel className={cn('px-0', state === 'collapsed' && 'sr-only')}>
              Workspaces
            </SidebarGroupLabel>
            <button
              onClick={() => setShowNewWorkspaceModal(true)}
              aria-label="Add workspace"
              className={cn(
                'flex h-[22px] w-[22px] items-center justify-center rounded-md text-[#8a897f] transition-opacity hover:bg-[#e6e5df] hover:text-[#54534a]',
                workspacesHover ? 'opacity-100' : 'opacity-0',
                state === 'collapsed' && 'hidden'
              )}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <SidebarGroupContent>
            <SidebarMenu>
              {workspaces.map((ws: any) => (
                <SidebarMenuItem key={ws.id}>
                  <SidebarMenuButton
                    onClick={() => handleWorkspaceSwitch?.(ws.slug)}
                    isActive={ws.slug === workspace.slug}
                    tooltip={ws.name}
                    className={cn(ws.slug === workspace.slug && '!bg-[#efeeea] !font-semibold !text-[#1b1b17]')}
                  >
                    <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[6px] bg-[#e6f3ea] text-[11px] font-bold text-[#1f8f4e]">
                      {ws.name?.charAt(0).toUpperCase() || 'W'}
                    </span>
                    <span className="truncate">{ws.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {devMode && (
          <SidebarGroup>
            <SidebarGroupLabel className={state === 'collapsed' ? 'sr-only' : ''}>Developer</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => router.push(`/workspace/${workspace.slug}`)} tooltip="Workspace Overview">
                    <Code2 />
                    <span>Workspace</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* Footer — Upgrade */}
      <SidebarFooter>
        <button
          onClick={() => router.push('/pricing')}
          className="flex w-full items-center justify-center gap-2 rounded-[11px] bg-[#f5b301] px-3 py-2.5 text-[14.5px] font-bold text-[#3a2e00] transition-[filter] hover:brightness-[1.04]"
        >
          <Sparkles className="h-4 w-4" />
          <span className="group-data-[collapsible=icon]:hidden">Upgrade</span>
        </button>
      </SidebarFooter>

      <SidebarRail />

      {/* Create organization dialog */}
      <Dialog open={showCreateOrgDialog} onOpenChange={setShowCreateOrgDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-org-name">Organization name</Label>
              <Input
                id="new-org-name"
                placeholder="Enter organization name"
                value={createOrgForm.name}
                onChange={(e) =>
                  setCreateOrgForm({
                    ...createOrgForm,
                    name: e.target.value,
                    slug: createOrgForm.slug || e.target.value.toLowerCase().replace(/\s+/g, '-'),
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor="new-org-slug">Organization slug</Label>
              <Input
                id="new-org-slug"
                placeholder="organization-slug"
                value={createOrgForm.slug}
                onChange={(e) => setCreateOrgForm({ ...createOrgForm, slug: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateOrgDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateOrg} disabled={creatingOrg}>
              {creatingOrg ? 'Creating...' : 'Create organization'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NewWorkspaceModal
        isOpen={showNewWorkspaceModal}
        onClose={() => setShowNewWorkspaceModal(false)}
        onCreated={(ws) => handleWorkspaceSwitch?.(ws.slug)}
      />
    </Sidebar>
  )
}
