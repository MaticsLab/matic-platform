"use client"

import React, { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { ChevronDown, Settings, LogOut, Building2, Bell, User, UserPlus, Building } from 'lucide-react'
import { clearLastWorkspace } from '@/lib/utils'
import { useWorkspaceDiscovery } from '@/hooks/useWorkspaceDiscovery'
import { useOrganizationDiscovery } from '@/hooks/useOrganizationDiscovery'
import { useSession, signOut as betterAuthSignOut } from '@/lib/better-auth-client'
import { Sidebar } from './Sidebar'
import { TabNavigation } from './TabNavigation'
import { WorkspaceSettingsSidebar } from './WorkspaceSettingsSidebar'
import { ProfileSidebar } from './ProfileSidebar'
import { InviteToWorkspaceSidebar } from './InviteToWorkspaceSidebar'
import { workspacesSupabase } from '@/lib/api/workspaces-supabase'
import { toast } from 'sonner'
import type { Workspace } from '@/types/workspaces'
import { SearchProvider, SearchBar, SearchPanel, useSearch } from './Search'
import { useTabContext } from './WorkspaceTabProvider'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui-components/dropdown-menu'

interface NavigationLayoutProps {
  children: React.ReactNode
  workspaceSlug?: string
}

export function NavigationLayout({ children, workspaceSlug }: NavigationLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { data, isPending: authLoading } = useSession()
  const hybridUser = data?.user || null
  
  const hybridSignOut = async () => {
    await betterAuthSignOut()
  }
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showProfileSidebar, setShowProfileSidebar] = useState(false)
  const [showInviteSidebar, setShowInviteSidebar] = useState(false)
  const [fullWorkspace, setFullWorkspace] = useState<Workspace | null>(null)
  
  const { workspaces, currentWorkspace, setCurrentWorkspaceBySlug } = useWorkspaceDiscovery()
  const { organizations, currentOrganization, switchToOrganization } = useOrganizationDiscovery()

  useEffect(() => {
    if (workspaceSlug && workspaces.length > 0) {
      setCurrentWorkspaceBySlug(workspaceSlug)
    }
  }, [workspaceSlug, workspaces, setCurrentWorkspaceBySlug])

  const handleSignOut = async () => {
    try {
      await hybridSignOut()
      // Clear any cached data
      clearLastWorkspace()
      // Redirect to login
      window.location.href = '/login'
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const handleOpenSettings = async () => {
    if (!currentWorkspace) return
    
    try {
      // Fetch full workspace data
      const workspace = await workspacesSupabase.getWorkspaceById(currentWorkspace.id)
      setFullWorkspace(workspace)
      setShowSettingsModal(true)
    } catch (error) {
      console.error('Error fetching workspace:', error)
      toast.error('Failed to load workspace settings')
    }
  }

  const handleWorkspaceUpdate = (updatedWorkspace: Workspace) => {
    // The workspace discovery hook will automatically pick up changes
    // via Supabase realtime, but we can force a refresh if needed
    setCurrentWorkspaceBySlug(updatedWorkspace.slug)
  }

  const handleWorkspaceSwitch = (slug: string) => {
    router.push(`/workspace/${slug}/activities-hubs`)
  }

  const getWorkspaceColor = (workspace: any) => {
    if (!workspace) return 'bg-violet-600'
    // If color is a hex value, return it for inline style, otherwise use Tailwind class
    const color = workspace.color || '#7C3AED' // Default violet-600
    return color.startsWith('#') ? color : `bg-${color}`
  }

  const getWorkspaceColorStyle = (workspace: any) => {
    const color = getWorkspaceColor(workspace)
    return color.startsWith('#') ? { backgroundColor: color } : {}
  }

  const getWorkspaceColorClass = (workspace: any) => {
    const color = getWorkspaceColor(workspace)
    return color.startsWith('#') ? '' : color
  }


  const getUserName = (email: string | undefined) => {
    if (!email) return 'User'
    const name = email.split('@')[0]
    return name.charAt(0).toUpperCase() + name.slice(1)
  }

  // Convert Better Auth user to the format expected by child components
  const user = hybridUser ? {
    email: hybridUser.email,
    user_metadata: {
      full_name: hybridUser.name,
      avatar_url: hybridUser.image || hybridUser.avatarUrl
    }
  } : null

  return (
    <SearchProvider>
      <NavigationLayoutInner 
        user={user}
        currentWorkspace={currentWorkspace}
        workspaces={workspaces}
        organizations={organizations}
        currentOrganization={currentOrganization}
        switchToOrganization={switchToOrganization}
        showSettingsModal={showSettingsModal}
        setShowSettingsModal={setShowSettingsModal}
        showInviteSidebar={showInviteSidebar}
        setShowInviteSidebar={setShowInviteSidebar}
        fullWorkspace={fullWorkspace}
        handleOpenSettings={handleOpenSettings}
        handleSignOut={handleSignOut}
        handleWorkspaceSwitch={handleWorkspaceSwitch}
        handleWorkspaceUpdate={handleWorkspaceUpdate}
        getWorkspaceColorClass={getWorkspaceColorClass}
        getWorkspaceColorStyle={getWorkspaceColorStyle}
        getUserName={getUserName}
      >
        {children}
      </NavigationLayoutInner>
    </SearchProvider>
  )
}

// Inner component that can use the SearchProvider context
function NavigationLayoutInner({
  children,
  user,
  currentWorkspace,
  workspaces,
  organizations,
  currentOrganization,
  switchToOrganization,
  showSettingsModal,
  setShowSettingsModal,
  showInviteSidebar,
  setShowInviteSidebar,
  fullWorkspace,
  handleOpenSettings,
  handleSignOut,
  handleWorkspaceSwitch,
  handleWorkspaceUpdate,
  getWorkspaceColorClass,
  getWorkspaceColorStyle,
  getUserName,
}: {
  children: React.ReactNode
  user: any
  currentWorkspace: any
  workspaces: any[]
  organizations: any[]
  currentOrganization: any
  switchToOrganization: (id: string) => void
  showSettingsModal: boolean
  setShowSettingsModal: (open: boolean) => void
  showInviteSidebar: boolean
  setShowInviteSidebar: (open: boolean) => void
  fullWorkspace: Workspace | null
  handleOpenSettings: () => void
  handleSignOut: () => void
  handleWorkspaceSwitch: (slug: string) => void
  handleWorkspaceUpdate: (workspace: Workspace) => void
  getWorkspaceColorClass: (workspace: any) => string
  getWorkspaceColorStyle: (workspace: any) => React.CSSProperties
  getUserName: (email: string | undefined) => string
}) {
  const { tabManager } = useTabContext()
  const { expandToPanel } = useSearch()
  // For profile sidebar
  const [showProfileSidebar, setShowProfileSidebar] = useState(false)

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <nav className="bg-white border-b border-gray-200">
        <div className="flex items-center justify-between gap-4 px-4 md:px-6 h-16">
          {/* Left: Workspace Selector */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {currentWorkspace && (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors">
                  <div 
                    className={`w-8 h-8 ${getWorkspaceColorClass(currentWorkspace)} rounded-lg flex items-center justify-center flex-shrink-0`}
                    style={getWorkspaceColorStyle(currentWorkspace)}
                  >
                    <Building2 className="h-4 w-4 text-white" />
                  </div>
                  <div className="hidden md:flex items-center gap-2">
                    <span className="text-sm text-gray-900">{currentWorkspace.name}</span>
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64 bg-white">
                  <DropdownMenuLabel>Switch Workspace</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {workspaces.map((ws) => {
                    const isCurrent = ws.id === currentWorkspace?.id
                    const workspaceColor = (ws as any).color || '#7C3AED'
                    const colorClass = workspaceColor.startsWith('#') ? '' : `bg-${workspaceColor}`
                    const colorStyle = workspaceColor.startsWith('#') ? { backgroundColor: workspaceColor } : {}
                    return (
                      <DropdownMenuItem 
                        key={ws.id}
                        onClick={() => !isCurrent && handleWorkspaceSwitch(ws.slug)}
                        className={isCurrent ? 'bg-gray-50' : ''}
                      >
                        <div className="flex items-center gap-3 w-full">
                          <div 
                            className={`w-8 h-8 ${colorClass} rounded-lg flex items-center justify-center flex-shrink-0`}
                            style={colorStyle}
                          >
                            <Building2 className="h-4 w-4 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm">{ws.name}</div>
                            <div className="text-xs text-gray-500">
                              {isCurrent ? 'Current workspace' : 'Switch to this workspace'}
                            </div>
                          </div>
                        </div>
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Center: Global Search */}
          <SearchBar
            workspaceId={currentWorkspace?.id}
            workspaceSlug={currentWorkspace?.slug}
            tabManager={tabManager}
            onExpandToPanel={expandToPanel}
          />

          {/* Right: Notifications & Account */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Notifications */}
            <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <Bell className="h-5 w-5 text-gray-600" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            {/* Account Dropdown */}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {user.user_metadata?.avatar_url ? (
                      <img src={user.user_metadata.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="h-4 w-4 text-white" />
                    )}
                  </div>
                  <div className="hidden md:block text-left">
                    <div className="text-sm text-gray-900">{user.user_metadata?.full_name || getUserName(user.email)}</div>
                    <div className="text-xs text-gray-500">{user.user_metadata?.role || 'Member'}</div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-gray-500 hidden md:block" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-white">
                  <DropdownMenuLabel>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {user.user_metadata?.avatar_url ? (
                          <img src={user.user_metadata.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User className="h-5 w-5 text-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm">{user.user_metadata?.full_name || getUserName(user.email)}</div>
                        <div className="text-xs text-gray-500 font-normal">{user.email}</div>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowProfileSidebar(true)}>
                    <User className="h-4 w-4 mr-2" />
                    My Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleOpenSettings}>
                    <Settings className="h-4 w-4 mr-2" />
                    Workspace Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowInviteSidebar(true)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Invite to Workspace
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} variant="destructive">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden bg-gray-100">
        {/* Sidebar */}
        {currentWorkspace && (
          <div className="pl-2 py-2 pr-1">
            <Sidebar workspaceId={currentWorkspace.id} />
          </div>
        )}

        <div className="flex-1 flex flex-col min-w-0 p-2 pl-1">
          <div className="flex-1 flex flex-col bg-white rounded-xl overflow-hidden shadow-sm">
            {/* Tab Navigation Bar */}
            {currentWorkspace && (
              <div className="border-b border-gray-200">
                <TabNavigation workspaceId={currentWorkspace.id} />
              </div>
            )}

            {/* Main Content */}
            <main className="flex-1 overflow-auto bg-gray-50">{children}</main>
          </div>
        </div>
      </div>
      
      {/* Search Panel (Slide-over) */}
      <SearchPanel
        workspaceId={currentWorkspace?.id}
        workspaceSlug={currentWorkspace?.slug}
        tabManager={tabManager}
      />
      
      {/* Workspace Settings Sidebar */}
      {fullWorkspace && (
        <WorkspaceSettingsSidebar
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          workspace={fullWorkspace}
          onUpdate={handleWorkspaceUpdate}
        />
      )}

      {/* Profile Sidebar */}
      <ProfileSidebar
        isOpen={showProfileSidebar}
        onClose={() => setShowProfileSidebar(false)}
      />

      {/* Invite to Workspace Sidebar */}
      {currentWorkspace && (
        <InviteToWorkspaceSidebar
          isOpen={showInviteSidebar}
          onClose={() => setShowInviteSidebar(false)}
          workspaceId={currentWorkspace.id}
          workspaceName={currentWorkspace.name}
        />
      )}
    </div>
  )
}
