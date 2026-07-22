import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth-helpers'
import { workspacesClient } from '@/lib/api/workspaces-client'
import { organizationsClient } from '@/lib/api/organizations-client'
import { toDiscoveryWorkspace } from '@/hooks/workspace-discovery-shared'
import { NavigationLayout } from '@/components/NavigationLayout'

/**
 * Server Component layout for every page under /workspace/[slug] that uses the
 * app shell (NavigationLayout) — everything except portal-editor, which lives
 * as a sibling outside this (dashboard) route group and gets none of this.
 *
 * Resolves auth + workspace + org data server-side, in parallel, and passes it
 * down as seed props so NavigationLayout's discovery hooks skip their own
 * client-side fetch on first load. Because this is a real layout.tsx (unlike
 * before, where NavigationLayout was instantiated fresh inside every page),
 * it also stays mounted across sibling navigations — switching between Home/
 * Starred/Trash/a form's pages no longer remounts the sidebar or re-fetches
 * the workspace/org lists each time.
 */
export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { slug: string }
}) {
  const user = await getAuthUser()
  if (!user) {
    redirect('/?login=true')
  }

  const [workspace, rawWorkspaces, organizations] = await Promise.all([
    workspacesClient.getBySlug(params.slug),
    workspacesClient.list(),
    organizationsClient.list(),
  ])

  const workspaces = (Array.isArray(rawWorkspaces) ? rawWorkspaces : []).map(toDiscoveryWorkspace)
  const currentWorkspace = workspace ? toDiscoveryWorkspace(workspace) : (workspaces[0] ?? null)

  const organizationsList = Array.isArray(organizations) ? organizations : []
  const currentOrganization =
    (workspace && organizationsList.find((org) => org.id === workspace.organization_id)) ||
    organizationsList[0] ||
    null

  return (
    <NavigationLayout
      workspaceSlug={params.slug}
      workspaceSeed={{ workspaces, currentWorkspace }}
      organizationSeed={{ organizations: organizationsList, currentOrganization }}
    >
      {children}
    </NavigationLayout>
  )
}
