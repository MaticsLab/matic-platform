'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAtom, useSetAtom, useAtomValue } from 'jotai'
import { Provider as JotaiProvider } from 'jotai'
import { ReactFlowProvider } from '@xyflow/react'
import { toast } from 'sonner'
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react'

import { WorkflowCanvas } from './workflow-canvas'
import { NodeConfigPanel } from './node-config-panel'
import { OverlayProvider } from '@/components/overlays/overlay-provider'
import { OverlayContainer } from '@/components/overlays/overlay-container'
import { Button } from '@/ui-components/button'
import { automationWorkflowsClient } from '@/lib/api/automation-workflows-client'
import {
  currentWorkflowIdAtom,
  currentWorkflowNameAtom,
  currentWorkflowVisibilityAtom,
  currentWorkspaceIdAtom,
  edgesAtom,
  hasUnsavedChangesAtom,
  isPanelAnimatingAtom,
  isSidebarCollapsedAtom,
  nodesAtom,
  workflowNotFoundAtom,
  isWorkflowOwnerAtom,
  hasSidebarBeenShownAtom,
  rightPanelWidthAtom,
} from '@/lib/workflow/workflow-store'

interface InlineWorkflowEditorContentProps {
  workflowId: string
  workspaceId: string
  onBack?: () => void
}

function InlineWorkflowEditorContent({ 
  workflowId, 
  workspaceId,
  onBack 
}: InlineWorkflowEditorContentProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Panel state
  const [panelWidth, setPanelWidth] = useState(30)
  const [panelVisible, setPanelVisible] = useState(true)
  const [isDraggingResize, setIsDraggingResize] = useState(false)
  
  // Jotai atoms
  const [nodes, setNodes] = useAtom(nodesAtom)
  const [edges, setEdges] = useAtom(edgesAtom)
  const setCurrentWorkflowId = useSetAtom(currentWorkflowIdAtom)
  const setCurrentWorkflowName = useSetAtom(currentWorkflowNameAtom)
  const setCurrentWorkflowVisibility = useSetAtom(currentWorkflowVisibilityAtom)
  const setCurrentWorkspaceId = useSetAtom(currentWorkspaceIdAtom)
  const setHasUnsavedChanges = useSetAtom(hasUnsavedChangesAtom)
  const [workflowNotFound, setWorkflowNotFound] = useAtom(workflowNotFoundAtom)
  const setIsPanelAnimating = useSetAtom(isPanelAnimatingAtom)
  const [panelCollapsed, setPanelCollapsed] = useAtom(isSidebarCollapsedAtom)
  const currentWorkflowName = useAtomValue(currentWorkflowNameAtom)
  const setIsWorkflowOwner = useSetAtom(isWorkflowOwnerAtom)
  const setHasSidebarBeenShown = useSetAtom(hasSidebarBeenShownAtom)
  const setRightPanelWidth = useSetAtom(rightPanelWidthAtom)

  // Load workflow data
  const loadWorkflow = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      setWorkflowNotFound(false)
      
      // Set workspace ID
      setCurrentWorkspaceId(workspaceId)
      
      // Load workflow
      const workflow = await automationWorkflowsClient.get(workflowId)
      
      if (!workflow) {
        setWorkflowNotFound(true)
        setError('Workflow not found')
        return
      }
      
      // Set workflow data in atoms
      setCurrentWorkflowId(workflow.id)
      setCurrentWorkflowName(workflow.name)
      setCurrentWorkflowVisibility(workflow.visibility || 'workspace')
      setIsWorkflowOwner(true) // Assume owner for inline editing
      
      // Parse and set nodes/edges - cast to proper types
      const workflowNodes = Array.isArray(workflow.nodes) 
        ? workflow.nodes.map((n: any) => ({
            ...n,
            data: {
              ...n.data,
              label: n.data?.label || 'Untitled',
            }
          }))
        : []
      const workflowEdges = Array.isArray(workflow.edges) ? workflow.edges : []
      
      setNodes(workflowNodes)
      setEdges(workflowEdges)
      setHasUnsavedChanges(false)
      
      // Initialize panel state
      setHasSidebarBeenShown(true)
      setRightPanelWidth('30')
      
    } catch (err) {
      console.error('Failed to load workflow:', err)
      if ((err as any)?.status === 404 || (err as any)?.message?.includes('not found')) {
        setWorkflowNotFound(true)
        setError('Workflow not found')
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load workflow')
      }
    } finally {
      setLoading(false)
    }
  }, [workflowId, workspaceId, setCurrentWorkflowId, setCurrentWorkflowName, setCurrentWorkflowVisibility, setCurrentWorkspaceId, setNodes, setEdges, setHasUnsavedChanges, setWorkflowNotFound, setIsWorkflowOwner, setHasSidebarBeenShown, setRightPanelWidth])

  // Load workflow on mount
  useEffect(() => {
    loadWorkflow()
  }, [loadWorkflow])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Reset atoms when unmounting
      setCurrentWorkflowId('')
      setCurrentWorkflowName('')
      setNodes([])
      setEdges([])
      setHasUnsavedChanges(false)
    }
  }, [setCurrentWorkflowId, setCurrentWorkflowName, setNodes, setEdges, setHasUnsavedChanges])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error || workflowNotFound) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            {workflowNotFound ? 'Workflow Not Found' : 'Error'}
          </h2>
          <p className="text-gray-600 mb-4">
            {error || 'The workflow you are looking for does not exist.'}
          </p>
          {onBack && (
            <Button variant="outline" onClick={onBack}>
              Back to Workflows
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden relative bg-[var(--sidebar)]">
      {/* Workflow Canvas - Full screen background */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          right: panelVisible && !panelCollapsed ? `${panelWidth}%` : 0,
          transition: isDraggingResize ? 'none' : 'right 300ms ease-in-out',
        }}
      >
        <WorkflowCanvas />
      </div>

      {/* Expand button when panel is collapsed */}
      {panelCollapsed && panelVisible && (
        <button
          className="pointer-events-auto absolute top-1/2 right-0 z-20 flex size-6 -translate-y-1/2 items-center justify-center rounded-l-full border border-r-0 bg-background shadow-sm transition-colors hover:bg-muted"
          onClick={() => {
            setIsPanelAnimating(true)
            setPanelCollapsed(false)
            setTimeout(() => setIsPanelAnimating(false), 350)
          }}
          type="button"
        >
          <ChevronLeft className="size-4" />
        </button>
      )}

      {/* Right panel overlay */}
      <div
        className="pointer-events-auto absolute inset-y-0 right-0 z-20 border-l bg-background transition-transform duration-300 ease-out"
        style={{
          width: `${panelWidth}%`,
          transform:
            panelVisible && !panelCollapsed
              ? 'translateX(0)'
              : 'translateX(100%)',
        }}
      >
        {/* Panel collapse button */}
        <button
          className="absolute -left-3 top-1/2 z-30 flex size-6 -translate-y-1/2 items-center justify-center rounded-full border bg-background shadow-sm transition-colors hover:bg-muted"
          onClick={() => {
            setIsPanelAnimating(true)
            setPanelCollapsed(true)
            setTimeout(() => setIsPanelAnimating(false), 350)
          }}
          type="button"
        >
          <ChevronRight className="size-4" />
        </button>

        <NodeConfigPanel />
      </div>
    </div>
  )
}

interface InlineWorkflowEditorProps {
  workflowId: string
  workspaceId: string
  onBack?: () => void
}

export function InlineWorkflowEditor({ workflowId, workspaceId, onBack }: InlineWorkflowEditorProps) {
  return (
    <JotaiProvider>
      <ReactFlowProvider>
        <OverlayProvider>
          <InlineWorkflowEditorContent 
            workflowId={workflowId} 
            workspaceId={workspaceId}
            onBack={onBack}
          />
          <OverlayContainer />
        </OverlayProvider>
      </ReactFlowProvider>
    </JotaiProvider>
  )
}
