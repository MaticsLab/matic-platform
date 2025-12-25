'use client'

import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ReactFlowProvider } from '@xyflow/react'
import { Provider as JotaiProvider } from 'jotai'

import { NavigationLayout } from '@/components/NavigationLayout'
import { OverlayProvider } from '@/components/overlays/overlay-provider'
import { Button } from '@/ui-components/button'
import { WorkflowCanvas } from '@/components/workflow/workflow-canvas'
import { NodeConfigPanel } from '@/components/workflow/node-config-panel'
import { automationWorkflowsClient } from '@/lib/api/automation-workflows-client'
import { workspacesSupabase } from '@/lib/api/workspaces-supabase'
import { integrationsAtom, integrationsLoadedAtom, integrationsVersionAtom } from '@/lib/integrations-store'
import type { IntegrationType } from '@/lib/types/integration'
import type { Workspace } from '@/types/workspaces'
import {
  currentWorkflowIdAtom,
  currentWorkflowNameAtom,
  currentWorkflowVisibilityAtom,
  currentWorkspaceIdAtom,
  edgesAtom,
  hasSidebarBeenShownAtom,
  hasUnsavedChangesAtom,
  isPanelAnimatingAtom,
  isSidebarCollapsedAtom,
  isWorkflowOwnerAtom,
  nodesAtom,
  rightPanelWidthAtom,
  updateNodeDataAtom,
  workflowNotFoundAtom,
  type WorkflowNode,
  type WorkflowVisibility,
} from '@/lib/workflow/workflow-store'
import { findActionById } from '@/lib/workflow/plugins'
import { api } from '@/lib/workflow-api-client'

// System actions that need integrations (not in plugin registry)
const SYSTEM_ACTION_INTEGRATIONS: Record<string, IntegrationType> = {
  "Database Query": "database",
};

// Helper to get required integration type for an action
function getRequiredIntegrationType(
  actionType: string
): IntegrationType | undefined {
  const action = findActionById(actionType);
  return (
    (action?.integration as IntegrationType | undefined) ||
    SYSTEM_ACTION_INTEGRATIONS[actionType]
  );
}

// Helper to check and fix a single node's integration
type IntegrationFixResult = {
  nodeId: string;
  newIntegrationId: string | undefined;
};

function checkNodeIntegration(
  node: WorkflowNode,
  allIntegrations: { id: string; type: string }[],
  validIntegrationIds: Set<string>
): IntegrationFixResult | null {
  const actionType = node.data.config?.actionType as string | undefined;
  if (!actionType) {
    return null;
  }

  const integrationType = getRequiredIntegrationType(actionType);
  if (!integrationType) {
    return null;
  }

  const currentIntegrationId = node.data.config?.integrationId as
    | string
    | undefined;
  const hasValidIntegration =
    currentIntegrationId && validIntegrationIds.has(currentIntegrationId);

  if (hasValidIntegration) {
    return null;
  }

  // Find available integrations of this type
  const available = allIntegrations.filter((i) => i.type === integrationType);

  if (available.length === 1) {
    return { nodeId: node.id, newIntegrationId: available[0].id };
  }
  if (available.length === 0 && currentIntegrationId) {
    return { nodeId: node.id, newIntegrationId: undefined };
  }
  return null;
}

// Workflow Editor Content Component
function WorkflowEditorContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = params.slug as string
  const workflowId = params.workflowId as string

  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Jotai atoms
  const [nodes, setNodes] = useAtom(nodesAtom)
  const [edges, setEdges] = useAtom(edgesAtom)
  const [currentWorkflowId, setCurrentWorkflowId] = useAtom(currentWorkflowIdAtom)
  const setCurrentWorkflowName = useSetAtom(currentWorkflowNameAtom)
  const setCurrentWorkflowVisibility = useSetAtom(currentWorkflowVisibilityAtom)
  const [isOwner, setIsWorkflowOwner] = useAtom(isWorkflowOwnerAtom)
  const setCurrentWorkspaceId = useSetAtom(currentWorkspaceIdAtom)
  const setHasUnsavedChanges = useSetAtom(hasUnsavedChangesAtom)
  const [workflowNotFound, setWorkflowNotFound] = useAtom(workflowNotFoundAtom)
  const setRightPanelWidth = useSetAtom(rightPanelWidthAtom)
  const setIsPanelAnimating = useSetAtom(isPanelAnimatingAtom)
  const [hasSidebarBeenShown, setHasSidebarBeenShown] = useAtom(hasSidebarBeenShownAtom)
  const [panelCollapsed, setPanelCollapsed] = useAtom(isSidebarCollapsedAtom)
  const currentWorkflowName = useAtomValue(currentWorkflowNameAtom)
  const updateNodeData = useSetAtom(updateNodeDataAtom)
  const setGlobalIntegrations = useSetAtom(integrationsAtom)
  const setIntegrationsLoaded = useSetAtom(integrationsLoadedAtom)
  const integrationsVersion = useAtomValue(integrationsVersionAtom)

  // Panel state
  const [panelWidth, setPanelWidth] = useState(30)
  const [panelVisible, setPanelVisible] = useState(hasSidebarBeenShown)
  const [isDraggingResize, setIsDraggingResize] = useState(false)
  const isResizing = useRef(false)
  const hasReadCookies = useRef(false)
  const nodesRef = useRef(nodes)
  const lastAutoFixRef = useRef<{ workflowId: string; version: number } | null>(null)

  // Keep nodes ref up to date
  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  // Load workspace and workflow data
  const loadExistingWorkflow = useCallback(async () => {
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
      setCurrentWorkflowVisibility((workflow.visibility as WorkflowVisibility) ?? 'private')
      setIsWorkflowOwner(workflow.is_owner !== false)
      setHasUnsavedChanges(false)
      setWorkflowNotFound(false)
    } catch (err) {
      console.error('Failed to load workflow:', err)
      setError(err instanceof Error ? err.message : 'Failed to load workflow')
    } finally {
      setLoading(false)
    }
  }, [slug, workflowId, setNodes, setEdges, setCurrentWorkflowId, setCurrentWorkflowName, 
      setCurrentWorkflowVisibility, setIsWorkflowOwner, setCurrentWorkspaceId, 
      setHasUnsavedChanges, setWorkflowNotFound])

  useEffect(() => {
    const loadWorkflowData = async () => {
      // Check if state is already loaded for this workflow
      if (currentWorkflowId === workflowId && nodes.length > 0) {
        setLoading(false)
        return
      }

      await loadExistingWorkflow()
    }

    loadWorkflowData()
  }, [workflowId, currentWorkflowId, nodes.length, loadExistingWorkflow])

  // Auto-fix invalid/missing integrations on workflow load or when integrations change
  useEffect(() => {
    // Skip if no nodes or no workflow
    if (nodes.length === 0 || !currentWorkflowId) {
      return
    }

    // Skip for non-owners (they can't modify the workflow)
    if (!isOwner) {
      return
    }

    // Skip if already checked for this workflow+version combination
    const lastFix = lastAutoFixRef.current
    if (
      lastFix &&
      lastFix.workflowId === currentWorkflowId &&
      lastFix.version === integrationsVersion
    ) {
      return
    }

    const autoFixIntegrations = async () => {
      try {
        const allIntegrations = await api.integration.getAll()
        setGlobalIntegrations(allIntegrations)
        setIntegrationsLoaded(true)

        const validIds = new Set(allIntegrations.map((i) => i.id))
        const fixes = nodes
          .map((node) => checkNodeIntegration(node, allIntegrations, validIds))
          .filter((fix): fix is IntegrationFixResult => fix !== null)

        for (const fix of fixes) {
          const node = nodes.find((n) => n.id === fix.nodeId)
          if (node) {
            updateNodeData({
              id: fix.nodeId,
              data: {
                config: {
                  ...node.data.config,
                  integrationId: fix.newIntegrationId,
                },
              },
            })
          }
        }

        // Mark this workflow+version as checked
        lastAutoFixRef.current = {
          workflowId: currentWorkflowId,
          version: integrationsVersion,
        }
      } catch (error) {
        console.error('Failed to auto-fix integrations:', error)
      }
    }

    autoFixIntegrations()
  }, [nodes, currentWorkflowId, isOwner, integrationsVersion, setGlobalIntegrations, 
      setIntegrationsLoaded, updateNodeData])

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
      // Save width to cookie
      document.cookie = `sidebar-width=${panelWidth}; path=/; max-age=31536000`
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [panelWidth])

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
      <div className="h-full flex flex-col overflow-hidden relative">
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

        {/* Workflow not found overlay */}
        {workflowNotFound && (
          <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center">
            <div className="rounded-lg border bg-background p-8 text-center shadow-lg">
              <h1 className="mb-2 font-semibold text-2xl">Workflow Not Found</h1>
              <p className="mb-6 text-muted-foreground">
                The workflow you&apos;re looking for doesn&apos;t exist or has been deleted.
              </p>
              <Button asChild>
                <Link href={`/workspace/${slug}/workflows`}>Back to Workflows</Link>
              </Button>
            </div>
          </div>
        )}

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
          {/* Resize handle with collapse button */}
          <div
            aria-orientation="vertical"
            aria-valuenow={panelWidth}
            className="group absolute inset-y-0 left-0 z-10 w-3 cursor-col-resize"
            onMouseDown={handleResizeStart}
            role="separator"
            tabIndex={0}
          >
            {/* Hover indicator */}
            <div className="absolute inset-y-0 left-0 w-1 bg-transparent transition-colors group-hover:bg-blue-500 group-active:bg-blue-600" />
            {/* Collapse button - hidden while resizing */}
            {!(isDraggingResize || panelCollapsed) && (
              <button
                className="absolute top-1/2 left-0 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-background opacity-0 shadow-sm transition-opacity hover:bg-muted group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsPanelAnimating(true)
                  setPanelCollapsed(true)
                  setTimeout(() => setIsPanelAnimating(false), 350)
                }}
                onMouseDown={(e) => e.stopPropagation()}
                type="button"
              >
                <ChevronRight className="size-4" />
              </button>
            )}
          </div>
          <NodeConfigPanel />
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
        <OverlayProvider>
          <WorkflowEditorContent />
        </OverlayProvider>
      </ReactFlowProvider>
    </JotaiProvider>
  )
}
