'use client'

import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ReactFlowProvider } from '@xyflow/react'
import { Provider as JotaiProvider } from 'jotai'

import { NavigationLayout } from '@/components/NavigationLayout'
import { Button } from '@/ui-components/button'
import { automationWorkflowsClient } from '@/lib/api/automation-workflows-client'
import { workspacesSupabase } from '@/lib/api/workspaces-supabase'
import type { Workspace } from '@/types/workspaces'
import {
  currentWorkflowIdAtom,
  currentWorkflowNameAtom,
  currentWorkflowVisibilityAtom,
  currentWorkspaceIdAtom,
  edgesAtom,
  hasSidebarBeenShownAtom,
  hasUnsavedChangesAtom,
  isLoadingAtom,
  isPanelAnimatingAtom,
  isSidebarCollapsedAtom,
  isWorkflowOwnerAtom,
  nodesAtom,
  rightPanelWidthAtom,
  selectedExecutionIdAtom,
  workflowNotFoundAtom,
  type WorkflowNode,
  type WorkflowVisibility,
} from '@/lib/workflow/workflow-store'

// Workflow Editor Content Component
function WorkflowEditorContent() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const workflowId = params.workflowId as string

  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Jotai atoms
  const [nodes, setNodes] = useAtom(nodesAtom)
  const [edges, setEdges] = useAtom(edgesAtom)
  const setCurrentWorkflowId = useSetAtom(currentWorkflowIdAtom)
  const setCurrentWorkflowName = useSetAtom(currentWorkflowNameAtom)
  const setCurrentWorkflowVisibility = useSetAtom(currentWorkflowVisibilityAtom)
  const setIsWorkflowOwner = useSetAtom(isWorkflowOwnerAtom)
  const setCurrentWorkspaceId = useSetAtom(currentWorkspaceIdAtom)
  const setHasUnsavedChanges = useSetAtom(hasUnsavedChangesAtom)
  const [workflowNotFound, setWorkflowNotFound] = useAtom(workflowNotFoundAtom)
  const setRightPanelWidth = useSetAtom(rightPanelWidthAtom)
  const setIsPanelAnimating = useSetAtom(isPanelAnimatingAtom)
  const [hasSidebarBeenShown, setHasSidebarBeenShown] = useAtom(hasSidebarBeenShownAtom)
  const [panelCollapsed, setPanelCollapsed] = useAtom(isSidebarCollapsedAtom)
  const currentWorkflowName = useAtomValue(currentWorkflowNameAtom)

  // Panel state
  const [panelWidth, setPanelWidth] = useState(30)
  const [panelVisible, setPanelVisible] = useState(hasSidebarBeenShown)
  const [isDraggingResize, setIsDraggingResize] = useState(false)
  const isResizing = useRef(false)
  const hasReadCookies = useRef(false)

  // Load workspace and workflow data
  useEffect(() => {
    loadData()
  }, [slug, workflowId])

  async function loadData() {
    try {
      setLoading(true)

      // Load workspace
      const ws = await workspacesSupabase.getWorkspaceBySlug(slug)
      setWorkspace(ws)
      setCurrentWorkspaceId(ws.id)

      // Load workflow
      const workflow = await automationWorkflowsClient.get(workflowId)

      if (!workflow) {
        setWorkflowNotFound(true)
        return
      }

      // Reset node statuses to idle and clear selection
      const nodesWithIdleStatus = (workflow.nodes as WorkflowNode[]).map((node) => ({
        ...node,
        selected: false,
        data: {
          ...node.data,
          status: 'idle' as const,
        },
      }))

      setNodes(nodesWithIdleStatus)
      setEdges(workflow.edges as any[])
      setCurrentWorkflowId(workflow.id)
      setCurrentWorkflowName(workflow.name)
      setCurrentWorkflowVisibility(workflow.visibility as WorkflowVisibility)
      setIsWorkflowOwner(workflow.is_owner)
      setHasUnsavedChanges(false)
      setWorkflowNotFound(false)
    } catch (err) {
      console.error('Failed to load workflow:', err)
      setError(err instanceof Error ? err.message : 'Failed to load workflow')
    } finally {
      setLoading(false)
    }
  }

  // Read sidebar preferences from cookies on mount
  useEffect(() => {
    if (hasReadCookies.current) return
    hasReadCookies.current = true

    const widthCookie = document.cookie
      .split('; ')
      .find((row) => row.startsWith('sidebar-width='))
    if (widthCookie) {
      const value = Number.parseFloat(widthCookie.split('=')[1])
      if (!Number.isNaN(value) && value >= 20 && value <= 50) {
        setPanelWidth(value)
      }
    }

    const collapsedCookie = document.cookie
      .split('; ')
      .find((row) => row.startsWith('sidebar-collapsed='))
    if (collapsedCookie) {
      setPanelCollapsed(collapsedCookie.split('=')[1] === 'true')
    }
  }, [setPanelCollapsed])

  // Trigger slide-in animation on mount
  useEffect(() => {
    const shouldAnimate = sessionStorage.getItem('animate-sidebar') === 'true'
    sessionStorage.removeItem('animate-sidebar')

    if (hasSidebarBeenShown || !shouldAnimate) {
      setPanelVisible(true)
      setHasSidebarBeenShown(true)
      return
    }

    setIsPanelAnimating(true)
    const timer = setTimeout(() => {
      setPanelVisible(true)
      setHasSidebarBeenShown(true)
    }, 100)
    const animationTimer = setTimeout(() => setIsPanelAnimating(false), 400)
    
    return () => {
      clearTimeout(timer)
      clearTimeout(animationTimer)
      setIsPanelAnimating(false)
    }
  }, [hasSidebarBeenShown, setHasSidebarBeenShown, setIsPanelAnimating])

  // Keyboard shortcut Cmd/Ctrl+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        setIsPanelAnimating(true)
        setPanelCollapsed((prev) => !prev)
        setTimeout(() => setIsPanelAnimating(false), 350)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setIsPanelAnimating, setPanelCollapsed])

  // Set right panel width for positioning
  useEffect(() => {
    if (panelVisible && !panelCollapsed) {
      setRightPanelWidth(`${panelWidth}%`)
    } else {
      setRightPanelWidth(null)
    }
    return () => {
      setRightPanelWidth(null)
    }
  }, [setRightPanelWidth, panelWidth, panelVisible, panelCollapsed])

  // Handle panel resize
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isResizing.current = true
    setIsDraggingResize(true)

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizing.current) return
      const newWidth = ((window.innerWidth - moveEvent.clientX) / window.innerWidth) * 100
      setPanelWidth(Math.min(50, Math.max(20, newWidth)))
    }

    const handleMouseUp = () => {
      isResizing.current = false
      setIsDraggingResize(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  if (loading) {
    return (
      <NavigationLayout workspaceSlug={slug}>
        <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
          <div className="text-gray-500">Loading workflow...</div>
        </div>
      </NavigationLayout>
    )
  }

  if (error || workflowNotFound || !workspace) {
    return (
      <NavigationLayout workspaceSlug={slug}>
        <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
              {workflowNotFound ? 'Workflow Not Found' : 'Error'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {error || 'The workflow you are looking for does not exist.'}
            </p>
            <Link
              href={`/workspace/${slug}/workflows`}
              className="text-blue-600 hover:underline"
            >
              Back to Workflows
            </Link>
          </div>
        </div>
      </NavigationLayout>
    )
  }

  return (
    <NavigationLayout workspaceSlug={slug}>
      <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <header className="h-14 border-b bg-white dark:bg-gray-800 flex items-center px-4 shrink-0">
          <Link
            href={`/workspace/${slug}/workflows`}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="text-sm">Workflows</span>
          </Link>
          <div className="mx-4 h-6 w-px bg-gray-200 dark:bg-gray-700" />
          <h1 className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {currentWorkflowName || 'Untitled Workflow'}
          </h1>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Canvas Area */}
          <div
            className="flex-1 relative"
            style={{
              marginRight: panelVisible && !panelCollapsed ? `${panelWidth}%` : 0,
              transition: isDraggingResize ? 'none' : 'margin-right 300ms ease-in-out',
            }}
          >
            {/* Workflow Canvas will be rendered here */}
            <div className="absolute inset-0 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <p className="mb-2">Workflow Canvas</p>
                <p className="text-sm text-gray-400">
                  {nodes.length} nodes, {edges.length} edges
                </p>
              </div>
            </div>
          </div>

          {/* Sidebar Toggle Button (when collapsed) */}
          {panelCollapsed && panelVisible && (
            <button
              type="button"
              onClick={() => {
                setIsPanelAnimating(true)
                setPanelCollapsed(false)
                setTimeout(() => setIsPanelAnimating(false), 350)
              }}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-white dark:bg-gray-800 border border-r-0 rounded-l-lg p-2 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}

          {/* Config Panel */}
          {panelVisible && (
            <div
              className="absolute right-0 top-0 bottom-0 bg-white dark:bg-gray-800 border-l shadow-lg overflow-hidden"
              style={{
                width: panelCollapsed ? 0 : `${panelWidth}%`,
                transition: isDraggingResize ? 'none' : 'width 300ms ease-in-out',
              }}
            >
              {/* Resize Handle */}
              <div
                className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 z-10"
                onMouseDown={handleResizeStart}
              />

              {/* Panel Header */}
              <div className="h-14 border-b flex items-center justify-between px-4">
                <span className="font-medium text-sm">Properties</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsPanelAnimating(true)
                    setPanelCollapsed(true)
                    setTimeout(() => setIsPanelAnimating(false), 350)
                  }}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Panel Content */}
              <div className="p-4 overflow-auto h-[calc(100%-3.5rem)]">
                <p className="text-sm text-gray-500">
                  Select a node to configure its properties.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </NavigationLayout>
  )
}

// Main Page Component with Providers
export default function WorkflowEditorPage() {
  return (
    <JotaiProvider>
      <ReactFlowProvider>
        <WorkflowEditorContent />
      </ReactFlowProvider>
    </JotaiProvider>
  )
}
