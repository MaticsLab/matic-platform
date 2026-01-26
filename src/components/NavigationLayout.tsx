"use client"

import React, { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { clearLastWorkspace } from '@/lib/utils'
import { useWorkspaceDiscovery } from '@/hooks/useWorkspaceDiscovery'
import { useOrganizationDiscovery } from '@/hooks/useOrganizationDiscovery'
import { useSession, signOut as betterAuthSignOut } from '@/lib/better-auth-client'
import { AppSidebar } from './AppSidebar'  // Explicit capitalized import
import { TabNavigation } from './TabNavigation'
import { WorkspaceSettingsSidebar } from './WorkspaceSettingsSidebar'
import { ProfileSidebar } from './ProfileSidebar'
import { InviteToWorkspaceSidebarV2 } from './InviteToWorkspaceSidebarV2'
import { UpdatePasswordDialog } from './UpdatePasswordDialog'
import { ApiKeyDialog } from './ApiKeyDialog'
import { workspacesSupabase } from '@/lib/api/workspaces-supabase'
import { toast } from 'sonner'
import type { Workspace } from '@/types/workspaces'
import { SearchProvider, SearchPanel } from './Search'
import { useTabContext } from './WorkspaceTabProvider'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/ui-components/sidebar'

interface NavigationLayoutProps {
  children: React.ReactNode
  workspaceSlug?: string
}

export function NavigationLayout({ children, workspaceSlug }: NavigationLayoutProps) {
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
  const [showInviteSidebar, setShowInviteSidebar] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false)
  const [fullWorkspace, setFullWorkspace] = useState<Workspace | null>(null)
  const [devMode, setDevMode] = useState(false)
  
  // Workspace and organization hooks
  const { workspaces, currentWorkspace, setCurrentWorkspaceBySlug } = useWorkspaceDiscovery()
  const { organizations, currentOrganization, switchToOrganization } = useOrganizationDiscovery()
  const { tabManager } = useTabContext()

  // Set current workspace on slug change
  useEffect(() => {
    if (workspaceSlug && workspaces.length > 0) {
      setCurrentWorkspaceBySlug(workspaceSlug)
    }
  }, [workspaceSlug, workspaces, setCurrentWorkspaceBySlug])

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
      const workspace = await workspacesSupabase.getWorkspaceById(currentWorkspace.id)
      setFullWorkspace(workspace)
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

  return (
    <SearchProvider>
      <SidebarProvider defaultOpen={true}>
        <div className="h-screen w-full overflow-hidden flex">
          {/* Sidebar */}
          {currentWorkspace && (
            <AppSidebar
              workspaceId={currentWorkspace.id}
              currentWorkspace={currentWorkspace}
              workspaces={workspaces}
              user={user}
              handleWorkspaceSwitch={handleWorkspaceSwitch}
              handleSignOut={handleSignOut}
              handleOpenSettings={handleOpenSettings}
              setShowProfileSidebar={setShowProfileSidebar}
              setShowPasswordDialog={setShowPasswordDialog}
              setShowApiKeyDialog={setShowApiKeyDialog}
              setShowInviteSidebar={setShowInviteSidebar}
              devMode={devMode}
              setDevMode={setDevMode}
            />
          )}

          {/* Main content - proper SidebarInset as direct sibling */}
          <SidebarInset className="flex-1 flex flex-col overflow-hidden min-w-0">
            {/* Tab Bar */}
            {currentWorkspace && (
              <div className="px-4 pt-2 pb-2 border-b bg-background/95 backdrop-blur flex items-center gap-2 shrink-0">
                <SidebarTrigger />
                <TabNavigation 
                  workspaceId={currentWorkspace.id}
                  setShowInviteSidebar={setShowInviteSidebar}
                />
              </div>
            )}
            
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
        tabManager={tabManager}
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
      <UpdatePasswordDialog
        isOpen={showPasswordDialog}
        onClose={() => setShowPasswordDialog(false)}
      />

      <ApiKeyDialog
        isOpen={showApiKeyDialog}
        onClose={() => setShowApiKeyDialog(false)}
      />

      {/* Invite Sidebar */}
      {currentWorkspace && showInviteSidebar && (
        <InviteToWorkspaceSidebarV2
          isOpen={showInviteSidebar}
          onClose={() => setShowInviteSidebar(false)}
          workspaceId={currentWorkspace.id}
          workspaceName={currentWorkspace.name}
        />
      )}
      
    </SearchProvider>
  )
}
