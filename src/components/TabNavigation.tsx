'use client'

import { useState, useEffect } from 'react'
import { X, Plus, FileText, Calendar, Users, Search, Settings } from 'lucide-react'
import { TabManager, TabData } from '@/lib/tab-manager'
import { useTabContext } from './WorkspaceTabProvider'
import { cn } from '@/lib/utils'
import { TabActionBar } from './TabActionBar'

interface TabNavigationProps {
  workspaceId: string
  onTabChange?: (tab: TabData | null) => void
  tabManager?: TabManager | null
}

const TAB_ICONS = {
  form: FileText,
  table: FileText,
  calendar: Calendar,
  project: Users,
  custom: Settings
}

export function TabNavigation({ workspaceId, onTabChange, tabManager: externalTabManager }: TabNavigationProps) {
  const { tabManager: contextTabManager, activeTab, tabs, triggerNavigation } = useTabContext()
  const tabManager = externalTabManager || contextTabManager
  
  // Use context values or local state as fallback
  const [localActiveTab, setLocalActiveTab] = useState<TabData | null>(null)
  const [localTabs, setLocalTabs] = useState<TabData[]>([])

  const currentActiveTab = activeTab || localActiveTab
  const currentTabs = tabs.length > 0 ? tabs : localTabs

  // Initialize Tab Manager if not provided and no context
  useEffect(() => {
    if (!externalTabManager && !contextTabManager) {
      const manager = new TabManager(workspaceId)
      // Set local tab manager - but we'll use context instead
      
      const unsubscribe = manager.subscribe(() => {
        const currentTabs = manager.getTabs()
        const currentActiveTab = manager.getActiveTab()
        
        setLocalTabs(currentTabs)
        setLocalActiveTab(currentActiveTab)
        onTabChange?.(currentActiveTab)
      })

      // Initial load
      setLocalTabs(manager.getTabs())
      setLocalActiveTab(manager.getActiveTab())

      return () => {
        unsubscribe()
        manager.destroy()
      }
    }
  }, [workspaceId, externalTabManager, contextTabManager])

  // Subscribe to tab changes when using external or context tab manager
  useEffect(() => {
    if (!tabManager) return

    const unsubscribe = tabManager.subscribe(() => {
      const currentTabs = tabManager.getTabs()
      const currentActiveTab = tabManager.getActiveTab()
      
      if (!contextTabManager) {
        setLocalTabs(currentTabs)
        setLocalActiveTab(currentActiveTab)
      }
      onTabChange?.(currentActiveTab)
    })

    // Initial load
    if (!contextTabManager) {
      setLocalTabs(tabManager.getTabs())
      setLocalActiveTab(tabManager.getActiveTab())
      onTabChange?.(tabManager.getActiveTab())
    }

    return unsubscribe
  }, [tabManager, onTabChange, contextTabManager])

  const handleTabClick = (tabId: string) => {
    tabManager?.setActiveTab(tabId)
  }

  const handleTabClose = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation()
    tabManager?.closeTab(tabId)
  }

  const handleNavigate = (direction: 'back' | 'forward') => {
    if (contextTabManager) {
      triggerNavigation(direction)
    } else {
      // Fallback for local usage without provider
      if (!tabManager || currentTabs.length === 0) return
      
      const currentIndex = currentTabs.findIndex(tab => tab.id === currentActiveTab?.id)
      if (currentIndex === -1) return

      if (direction === 'back' && currentIndex > 0) {
        const previousTab = currentTabs[currentIndex - 1]
        tabManager.setActiveTab(previousTab.id)
      } else if (direction === 'forward' && currentIndex < currentTabs.length - 1) {
        const nextTab = currentTabs[currentIndex + 1]
        tabManager.setActiveTab(nextTab.id)
      }
    }
  }

  if (!tabManager) {
    return (
      <div className="flex items-center bg-white border-b border-gray-200 px-4 py-2">
        <div className="text-sm text-gray-500">Loading tabs...</div>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-end px-4 pt-2 pb-0 gap-1 bg-white border-b border-gray-200">
        {/* Tab List */}
        <div className="flex items-end overflow-x-auto scrollbar-hide gap-1">
          {currentTabs.map((tab) => {
            const IconComponent = TAB_ICONS[tab.type] || FileText
            const isActive = currentActiveTab?.id === tab.id
            // Check for Overview/workspace tab - be specific to avoid matching all workspace tabs
            const isOverviewTab = 
              tab.id === 'overview' || 
              (tab.title === 'Overview' && tab.url === `/workspace/${workspaceId}`) ||
              (tab.type === 'custom' && tab.icon === 'home')
            
            return (
              <div
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-3 cursor-pointer min-w-0 max-w-48 group relative text-sm",
                  isActive ? "tab-selected" : "tab-unselected"
                )}
              >
                <IconComponent size={14} className="flex-shrink-0 opacity-70" />
                <span className="truncate">
                  {tab.title}
                </span>
                {!isOverviewTab && (
                  <button
                    onClick={(e) => handleTabClose(e, tab.id)}
                    className={cn(
                      "opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-200 rounded flex-shrink-0 transition-opacity ml-auto",
                      isActive && "hover:bg-gray-200"
                    )}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Action Bar */}
      <TabActionBar 
        activeTab={currentActiveTab} 
        workspaceId={workspaceId}
        tabs={currentTabs}
        onAddTab={(tab) => tabManager?.addTab(tab)}
        onNavigate={handleNavigate}
      />
    </>
  )
}

// Quick actions for opening different types of tabs
function TabQuickActions({ tabManager, workspaceId }: { 
  tabManager: TabManager | null
  workspaceId: string 
}) {
  const quickActions = [
    {
      label: 'New Document',
      type: 'custom' as const,
      icon: FileText,
      url: `/w/${workspaceId}/docs/new`
    },
    {
      label: 'New Form',
      type: 'form' as const,
      icon: FileText,
      url: `/w/${workspaceId}/forms/new`
    },
    {
      label: 'Calendar',
      type: 'calendar' as const,
      icon: Calendar,
      url: `/w/${workspaceId}/calendar`
    }
  ]

  const handleQuickAction = (action: typeof quickActions[0]) => {
    tabManager?.addTab({
      title: action.label,
      type: action.type,
      url: action.url,
      workspaceId,
      metadata: {}
    })
  }

  return (
    <div className="flex items-center gap-1">
      {quickActions.map((action) => (
        <button
          key={action.type}
          onClick={() => handleQuickAction(action)}
          className="p-2 hover:bg-gray-100 rounded text-gray-500 transition-colors"
          title={action.label}
        >
          <action.icon size={16} />
        </button>
      ))}
    </div>
  )
}

// Individual Tab Component for reusability
export function TabItem({ 
  tab,
  isActive,
  onActivate, 
  onClose 
}: { 
  tab: TabData
  isActive: boolean
  onActivate: () => void
  onClose: () => void
}) {
  const IconComponent = TAB_ICONS[tab.type] || FileText

  return (
    <div
      onClick={onActivate}
      className={cn(
        "flex items-center gap-2 px-3 py-2 border-r border-gray-200 cursor-pointer min-w-0 max-w-48 group relative",
        isActive 
          ? "bg-blue-50 text-blue-700 border-b-2 border-b-blue-600" 
          : "hover:bg-gray-50 text-gray-600"
      )}
    >
      <IconComponent size={14} className="flex-shrink-0" />
      <span className="truncate text-sm font-medium">
        {tab.title}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        className={cn(
          "opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded flex-shrink-0 transition-opacity",
          isActive && "opacity-100"
        )}
      >
        <X size={12} />
      </button>
    </div>
  )
}