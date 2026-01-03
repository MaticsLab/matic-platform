"use client"

import React, { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Settings, LogOut, UserPlus } from 'lucide-react'
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
import { SearchProvider, SearchPanel } from './Search'
import { useTabContext } from './WorkspaceTabProvider'

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
      avatar_url: hybridUser.image || (hybridUser as any).avatarUrl
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
  // For profile sidebar
  const [showProfileSidebar, setShowProfileSidebar] = useState(false)
  const { tabManager } = useTabContext()

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="flex flex-1 overflow-hidden bg-gray-100">
        {/* Sidebar */}
        {currentWorkspace && (
          <div className="pl-2 py-2 pr-1">
            <Sidebar 
              workspaceId={currentWorkspace.id}
              currentWorkspace={currentWorkspace}
              workspaces={workspaces}
              organizations={organizations}
              currentOrganization={currentOrganization}
              switchToOrganization={switchToOrganization}
              handleWorkspaceSwitch={handleWorkspaceSwitch}
              getWorkspaceColorClass={getWorkspaceColorClass}
              getWorkspaceColorStyle={getWorkspaceColorStyle}
            />
          </div>
        )}

        <div className="flex-1 flex flex-col min-w-0 p-2 pl-1">
          <div className="flex-1 flex flex-col bg-white rounded-xl overflow-hidden shadow-sm">
            {/* Tab Navigation Bar */}
            {currentWorkspace && (
              <div className="border-b border-gray-200">
                <TabNavigation 
                  workspaceId={currentWorkspace.id}
                  user={user}
                  getUserName={getUserName}
                  handleSignOut={handleSignOut}
                  handleOpenSettings={handleOpenSettings}
                  setShowProfileSidebar={setShowProfileSidebar}
                  setShowInviteSidebar={setShowInviteSidebar}
                />
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
