import { workspacesClient } from '@/lib/api/workspaces-client'
import { WorkspaceHome } from '@/components/WorkspaceHome'

export default async function WorkspacePage({ params }: { params: { slug: string } }) {
  const workspace = await workspacesClient.getBySlug(params.slug)

  if (!workspace) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2 text-gray-900">Workspace Not Found</h1>
          <a href="/?login=true" className="text-blue-600 hover:underline">
            Back to Login
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <WorkspaceHome workspaceId={workspace.id} workspaceSlug={workspace.slug} workspaceName={workspace.name} />
    </div>
  )
}
