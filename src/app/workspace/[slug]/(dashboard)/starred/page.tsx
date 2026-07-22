import { workspacesClient } from '@/lib/api/workspaces-client'
import { WorkspaceItemsList } from '@/components/WorkspaceItemsList'

export default async function StarredPage({ params }: { params: { slug: string } }) {
  const workspace = await workspacesClient.getBySlug(params.slug)

  if (!workspace) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Workspace not found</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#faf9f7]">
      <div className="px-10 py-8">
        <h1 className="mb-6 text-[26px] font-extrabold tracking-tight text-[#1b1b17]">Starred</h1>
        <WorkspaceItemsList
          workspaceId={workspace.id}
          workspaceSlug={params.slug}
          filter="starred"
          emptyMessage="Nothing starred yet — star a form or table to find it here."
        />
      </div>
    </div>
  )
}
