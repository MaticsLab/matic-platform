import { workspacesClient } from '@/lib/api/workspaces-client'
import { FormAnalyticsPage } from '@/components/FormAnalytics/FormAnalyticsPage'

export default async function FormAnalyticsRoute({ params }: { params: { slug: string; formId: string } }) {
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
      <FormAnalyticsPage workspaceId={workspace.id} formId={params.formId} />
    </div>
  )
}
