'use client'

import * as React from 'react'
import {
  Building2,
  Code2,
  Database,
  GraduationCap,
  Users,
  ChevronsUpDown,
  User,
  Settings2,
  LogOut,
  Key,
  Lock,
  UserPlus,
} from 'lucide-react'

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/ui-components/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui-components/dropdown-menu'
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
import { useTabContext } from './WorkspaceTabProvider'
import ModeToggle from '@/components/mode-toggle'
import { OrganizationMenu } from './OrganizationMenu'
import { cn } from '@/lib/utils'

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
  const { tabManager, activeTab } = useTabContext()
  const { state } = useSidebar()

  const navItems = [
    { title: 'Programs', icon: GraduationCap, slug: 'applications' },
    { title: 'Database', icon: Database, slug: 'tables' },
    { title: 'CRM', icon: Users, slug: 'crm' },
  ]

  const handleTabClick = (slug: string) => {
    if (!tabManager) return
    
    const workspace = currentWorkspace || { slug: workspaceId }
    tabManager.addTab({
      id: `${workspace.slug}-${slug}`,
      title: slug.charAt(0).toUpperCase() + slug.slice(1),
      type: 'custom',
      url: `/workspace/${workspace.slug}/${slug}`,
      workspaceId: workspace.slug,
    })
  }

  const getUserInitials = (user: any) => {
    if (user?.display_name) {
      return user.display_name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    if (user?.email) {
      return user.email.slice(0, 2).toUpperCase()
    }
    return 'U'
  }

  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      {/* Header - Workspace Switcher */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="w-full justify-start">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Building2 className="size-4" />
              </div>
              <div className={cn(
                "grid flex-1 text-left text-sm leading-tight",
                state === "collapsed" && "sr-only"
              )}>
                <span className="truncate font-semibold">
                  {currentWorkspace?.name || 'Workspace'}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Main Navigation */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className={state === "collapsed" ? "sr-only" : ""}>
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = activeTab?.type === item.slug
                return (
                  <SidebarMenuItem key={item.slug}>
                    <SidebarMenuButton
                      onClick={() => handleTabClick(item.slug)}
                      isActive={isActive}
                      tooltip={item.title}
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

        {/* Developer Section */}
        {devMode && (
          <SidebarGroup>
            <SidebarGroupLabel className={state === "collapsed" ? "sr-only" : ""}>
              Developer
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => handleTabClick('workspace')}
                    tooltip="Workspace Overview"
                  >
                    <Code2 />
                    <span>Workspace</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* Footer - Invite Button and User Menu */}
      <SidebarFooter>
        <SidebarMenu>
          {/* Invite User Button */}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => setShowInviteSidebar?.(true)}
              tooltip="Invite Users"
              className="hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              <UserPlus className="h-4 w-4" />
              <span>Invite Users</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          
          {/* User Profile Menu */}
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage
                      src={user?.avatar_url}
                      alt={user?.display_name || user?.email}
                    />
                    <AvatarFallback className="rounded-lg">
                      {getUserInitials(user)}
                    </AvatarFallback>
                  </Avatar>
                  <div className={cn(
                    "grid flex-1 text-left text-sm leading-tight",
                    state === "collapsed" && "sr-only"
                  )}>
                    <span className="truncate font-semibold">
                      {user?.display_name || 'User'}
                    </span>
                    <span className="truncate text-xs">
                      {user?.email}
                    </span>
                  </div>
                  <ChevronsUpDown className={cn(
                    "ml-auto size-4",
                    state === "collapsed" && "sr-only"
                  )} />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="min-w-80 rounded-lg"
                side="right"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage src={user?.avatar_url} />
                      <AvatarFallback className="rounded-lg">
                        {getUserInitials(user)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">
                        {user?.display_name || 'User'}
                      </span>
                      <span className="truncate text-xs">
                        {user?.email}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                
                <DropdownMenuSeparator />
                
                {/* Organization Section */}
                <div className="p-1">
                  <div className="text-xs font-medium text-gray-500 px-2 py-1.5">
                    Organization
                  </div>
                  <OrganizationMenu />
                </div>
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem onClick={() => setShowProfileSidebar?.(true)}>
                  <User />
                  Profile
                </DropdownMenuItem>
                
                <DropdownMenuItem onClick={() => setShowPasswordDialog?.(true)}>
                  <Lock />
                  Change Password
                </DropdownMenuItem>
                
                <DropdownMenuItem onClick={() => setShowApiKeyDialog?.(true)}>
                  <Key />
                  API Keys
                </DropdownMenuItem>
                
                <DropdownMenuItem onClick={handleOpenSettings}>
                  <Settings2 />
                  Settings
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className="text-sm">Developer Mode</span>
                  <Switch
                    checked={devMode}
                    onCheckedChange={setDevMode}
                  />
                </div>
                
                <DropdownMenuSeparator />
                
                <div className="p-2">
                  <ModeToggle />
                </div>
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      
      <SidebarRail />
    </Sidebar>
  )
}