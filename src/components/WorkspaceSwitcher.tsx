'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2,
  ChevronsUpDown,
  Plus,
  Check,
} from 'lucide-react'

import { Button } from '@/ui-components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui-components/dropdown-menu'
import { cn } from '@/lib/utils'

interface Workspace {
  id: string
  name: string
  slug: string
  plan?: string
}

interface WorkspaceSwitcherProps {
  workspaces: Workspace[]
  currentWorkspace?: Workspace | null
  onSwitch?: (workspace: Workspace) => void
  onCreateNew?: () => void
  className?: string
}

export function WorkspaceSwitcher({
  workspaces = [],
  currentWorkspace,
  onSwitch,
  onCreateNew,
  className,
}: WorkspaceSwitcherProps) {
  const router = useRouter()

  const handleWorkspaceSelect = (workspace: Workspace) => {
    if (onSwitch) {
      onSwitch(workspace)
    } else {
      // Default behavior: navigate to workspace
      localStorage.setItem('lastWorkspace', workspace.slug)
      router.push(`/workspace/${workspace.slug}`)
    }
  }

  const handleCreateNew = () => {
    if (onCreateNew) {
      onCreateNew()
    } else {
      // Default behavior: could navigate to workspace creation page
      console.log('Create new workspace')
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn("w-[200px] justify-between", className)}
        >
          <div className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {currentWorkspace?.name || 'Select workspace'}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[200px]">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {workspaces.map((workspace) => (
          <DropdownMenuItem
            key={workspace.id}
            onClick={() => handleWorkspaceSelect(workspace)}
            className="cursor-pointer"
          >
            <Building2 className="mr-2 h-4 w-4" />
            <span className="flex-1 truncate">{workspace.name}</span>
            {currentWorkspace?.id === workspace.id && (
              <Check className="ml-2 h-4 w-4" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleCreateNew}
          className="cursor-pointer"
        >
          <Plus className="mr-2 h-4 w-4" />
          <span>Create workspace</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
