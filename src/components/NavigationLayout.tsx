"use client"

import React, { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { clearLastWorkspace, saveLastWorkspace } from '@/lib/utils'
import { useWorkspaceDiscovery, type WorkspaceDiscoverySeed } from '@/hooks/useWorkspaceDiscovery'
import { useOrganizationDiscovery, type OrganizationDiscoverySeed } from '@/hooks/useOrganizationDiscovery'
import { useSession, signOut as betterAuthSignOut } from '@/auth/client/main'
import { AppSidebar } from './AppSidebar'  // Explicit capitalized import
import { AppSidebarSkeleton } from './AppSidebarSkeleton'
import { WorkspaceSettingsSidebar } from './WorkspaceSettingsSidebar'
import { ProfileSidebar } from './ProfileSidebar'
import { OrganizationMembersSheet } from './OrganizationMembersSheet'
import { ApiKeyDialog } from './ApiKeyDialog'
import { workspacesClient } from '@/lib/api/workspaces-client'
import { toast } from 'sonner'
import type { Workspace } from '@/types/workspaces'
import { SearchProvider, SearchPanel } from './Search'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/ui-components/sidebar'

interface NavigationLayoutProps {
  children: React.ReactNode
  workspaceSlug?: string
  /** Server-fetched initial data (see the (dashboard) layout.tsx) — when
   * provided, the two discovery hooks skip their own initial fetch entirely,
   * eliminating the client-side waterfall on first load. All later
   * interactive behavior (switching workspace/org, refetch-after-create)
   * is unaffected. */
  workspaceSeed?: WorkspaceDiscoverySeed
  organizationSeed?: OrganizationDiscoverySeed
}

export function NavigationLayout({ children, workspaceSlug, workspaceSeed, organizationSeed }: NavigationLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { data, isPending: authLoading } = useSession()
  const hybridUser = data?.user || null
  
  // Auth functions
  const hybridSignOut = async () => {
    await betterAuthSignOut()
  }
  
  // State management
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showProfileSidebar, setShowProfileSidebar] = useState(false)
  const [showMembersSheet, setShowMembersSheet] = useState(false)
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false)
  const [fullWorkspace, setFullWorkspace] = useState<Workspace | null>(null)
  const [devMode, setDevMode] = useState(false)
  
  // Workspace and organization hooks
  const { workspaces, currentWorkspace, loading: workspacesLoading, setCurrentWorkspaceBySlug } = useWorkspaceDiscovery(workspaceSeed)
  const { organizations, currentOrganization, switchToOrganization } = useOrganizationDiscovery(organizationSeed)

  // Set current workspace on slug change
  useEffect(() => {
    if (workspaceSlug && workspaces.length > 0) {
      setCurrentWorkspaceBySlug(workspaceSlug)
    }
  }, [workspaceSlug, workspaces, setCurrentWorkspaceBySlug])

  // Remember the last-visited workspace (localStorage, client-only) — centralized
  // here now that every dashboard page shares this one layout, rather than each
  // page calling this individually (previously inconsistent: 2 of 5 pages never did).
  useEffect(() => {
    if (workspaceSlug) {
      saveLastWorkspace(workspaceSlug)
    }
  }, [workspaceSlug])

  // Event handlers
  const handleSignOut = async () => {
    try {
      await hybridSignOut()
      clearLastWorkspace()
      window.location.href = '/'
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const handleOpenSettings = async () => {
    if (!currentWorkspace) return
    
    try {
      const workspace = await workspacesClient.get(currentWorkspace.id)
      const normalizedWorkspace: Workspace = {
        ...workspace,
        settings: workspace.settings ?? {},
        is_archived: workspace.is_archived ?? false,
      }
      setFullWorkspace(normalizedWorkspace)
      setShowSettingsModal(true)
    } catch (error) {
      console.error('Error fetching workspace:', error)
      toast.error('Failed to load workspace settings')
    }
  }

  const handleWorkspaceUpdate = (updatedWorkspace: Workspace) => {
    setCurrentWorkspaceBySlug(updatedWorkspace.slug)
  }

  const handleWorkspaceSwitch = (slug: string) => {
    router.push(`/workspace/${slug}`)
  }

  const getUserName = (email: string | undefined) => {
    if (!email) return 'User'
    const name = email.split('@')[0]
    return name.charAt(0).toUpperCase() + name.slice(1)
  }

  // Format user data for components
  const user = hybridUser ? {
    email: hybridUser.email,
    user_metadata: {
      full_name: hybridUser.name,
      avatar_url: hybridUser.image || (hybridUser as any).avatarUrl
    }
  } : null

  // Read persisted sidebar state from cookie (written by SidebarProvider on toggle)
  const sidebarDefaultOpen = React.useMemo(() => {
    if (typeof document === 'undefined') return true
    const match = document.cookie.match(/(?:^|;\s*)sidebar_state=([^;]*)/)
    if (!match) return true
    return match[1] === 'true'
  }, [])

  return (
    <SearchProvider>
      <SidebarProvider defaultOpen={sidebarDefaultOpen}>
        <div className="h-screen w-full overflow-hidden flex">
          {/* Sidebar */}
          {currentWorkspace ? (
            <AppSidebar
              workspaceId={currentWorkspace.id}
              currentWorkspace={currentWorkspace}
              workspaces={workspaces}
              user={user}
              handleWorkspaceSwitch={handleWorkspaceSwitch}
              handleSignOut={handleSignOut}
              handleOpenSettings={handleOpenSettings}
              setShowProfileSidebar={setShowProfileSidebar}
              setShowApiKeyDialog={setShowApiKeyDialog}
              setShowMembersSheet={setShowMembersSheet}
              devMode={devMode}
              setDevMode={setDevMode}
            />
          ) : workspacesLoading ? (
            <AppSidebarSkeleton />
          ) : null}

          {/* Main content - proper SidebarInset as direct sibling */}
          <SidebarInset className="flex-1 flex flex-col overflow-hidden min-w-0">
            {/* Page Content - scrollable area */}
            <div className="flex-1 overflow-hidden">
              <div className="h-full overflow-y-auto">
                {children}
              </div>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>

      {/* Overlays and Modals - moved outside SidebarProvider for proper peer CSS */}
      
      {/* Search Panel */}
      <SearchPanel
        workspaceId={currentWorkspace?.id}
        workspaceSlug={currentWorkspace?.slug}
      />
      
      {/* Settings Sidebar */}
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

      {/* Dialogs */}
      <ApiKeyDialog
        isOpen={showApiKeyDialog}
        onClose={() => setShowApiKeyDialog(false)}
      />

      {/* Organization Members Sheet */}
      {currentWorkspace && showMembersSheet && (
        <OrganizationMembersSheet
          isOpen={showMembersSheet}
          onClose={() => setShowMembersSheet(false)}
          workspaceId={currentWorkspace.id}
          workspaceName={currentWorkspace.name}
        />
      )}
      
    </SearchProvider>
  )
}
