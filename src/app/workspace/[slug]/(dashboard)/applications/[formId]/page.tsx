import { workspacesClient } from '@/lib/api/workspaces-client'
import { ApplicationManager } from '@/components/ApplicationsHub/Applications/ApplicationManager'

export default async function SubmissionsRoute({ params }: { params: { slug: string; formId: string } }) {
  const workspace = await workspacesClient.getBySlug(params.slug)

  if (!workspace) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Workspace not found</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <ApplicationManager formId={params.formId} workspaceId={workspace.id} />
    </div>
  )
}
