'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/ui-components/dialog'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { Button } from '@/ui-components/button'
import { toast } from 'sonner'
import { workspacesClient, type Workspace } from '@/lib/api/workspaces-client'
import { useActiveOrganization } from '@/auth/client/main'

interface NewWorkspaceModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated?: (workspace: Workspace) => void
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function NewWorkspaceModal({ isOpen, onClose, onCreated }: NewWorkspaceModalProps) {
  const router = useRouter()
  const { data: activeOrg } = useActiveOrganization()
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)

  const initial = name.trim().charAt(0).toUpperCase() || '?'

  const handleClose = () => {
    if (creating) return
    setName('')
    onClose()
  }

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Workspace name is required')
      return
    }
    if (!activeOrg?.id) {
      toast.error('No active organization')
      return
    }

    setCreating(true)
    try {
      const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 7)}`
      const workspace = await workspacesClient.create({
        organization_id: activeOrg.id,
        name: name.trim(),
        slug,
      })
      toast.success('Workspace created')
      onCreated?.(workspace)
      setName('')
      onClose()
      router.push(`/workspace/${workspace.slug}`)
    } catch (err) {
      console.error('Failed to create workspace:', err)
      toast.error('Failed to create workspace')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Workspace</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-3 py-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-white font-semibold">
            {initial}
          </div>
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="workspace-name">Workspace name</Label>
            <Input
              id="workspace-name"
              placeholder="My workspace"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={creating}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? 'Creating...' : 'Create workspace'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
