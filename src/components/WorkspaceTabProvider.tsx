'use client'

import React, { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { TabManager, TabData } from '@/lib/tab-manager'

export interface TabAction {
  label: string
  icon: any
  onClick: () => void
  variant?: 'default' | 'outline' | 'ghost'
}

export interface TabNavItem {
  id: string
  label: string
  icon: any
  badge?: number
  badgeColor?: string
}

export interface TabHeaderContent {
  title: string
  subtitle?: string
  subModule?: string // e.g. "Review Center", "Communications"
  navItems?: TabNavItem[]
  activeNavId?: string
  onNavChange?: (id: string) => void
}

interface TabContextType {
  tabManager: TabManager | null
  activeTab: TabData | null
  tabs: TabData[]
  registerNavigationHandler: (handler: ((direction: 'back' | 'forward') => boolean) | null) => void
  triggerNavigation: (direction: 'back' | 'forward') => void
  tabActions: TabAction[]
  setTabActions: (actions: TabAction[]) => void
  tabHeaderContent: TabHeaderContent | null
  setTabHeaderContent: (content: TabHeaderContent | null) => void
}

const TabContext = createContext<TabContextType>({
  tabManager: null,
  activeTab: null,
  tabs: [],
  registerNavigationHandler: () => {},
  triggerNavigation: () => {},
  tabActions: [],
  setTabActions: () => {},
  tabHeaderContent: null,
  setTabHeaderContent: () => {}
})

export const useTabContext = () => useContext(TabContext)

interface WorkspaceTabProviderProps {
  children: React.ReactNode
  workspaceId: string
}

export function WorkspaceTabProvider({ children, workspaceId }: WorkspaceTabProviderProps) {
  const [tabManager, setTabManager] = useState<TabManager | null>(null)
  const [activeTab, setActiveTab] = useState<TabData | null>(null)
  const [tabs, setTabs] = useState<TabData[]>([])
  const [navigationHandler, setNavigationHandler] = useState<((direction: 'back' | 'forward') => boolean) | null>(null)
  const [tabActions, setTabActions] = useState<TabAction[]>([])
  const [tabHeaderContent, setTabHeaderContent] = useState<TabHeaderContent | null>(null)

  const registerNavigationHandler = useCallback((handler: ((direction: 'back' | 'forward') => boolean) | null) => {
    setNavigationHandler(() => handler)
  }, [])

  const triggerNavigation = useCallback((direction: 'back' | 'forward') => {
    // Try custom handler first
    if (navigationHandler) {
      const handled = navigationHandler(direction)
      if (handled) return
    }

    // Fallback to tab switching
    if (!tabManager || tabs.length === 0) return
    
    const currentIndex = tabs.findIndex(tab => tab.id === activeTab?.id)
    if (currentIndex === -1) return

    if (direction === 'back' && currentIndex > 0) {
      const previousTab = tabs[currentIndex - 1]
      tabManager.setActiveTab(previousTab.id)
    } else if (direction === 'forward' && currentIndex < tabs.length - 1) {
      const nextTab = tabs[currentIndex + 1]
      tabManager.setActiveTab(nextTab.id)
    }
  }, [navigationHandler, tabManager, tabs, activeTab])

  // Initialize tab manager
  useEffect(() => {
    const manager = new TabManager(workspaceId)
    setTabManager(manager)

    // Subscribe to tab changes
    const unsubscribe = manager.subscribe(() => {
      const currentTabs = manager.getTabs()
      const currentActiveTab = manager.getActiveTab()
      
      // Auto-create Overview tab if all tabs are closed
      if (currentTabs.length === 0) {
        manager.addTab({
          id: 'overview',
          title: 'Overview',
          type: 'custom',
          url: `/workspace/${workspaceId}`,
          icon: 'home',
          workspaceId
        })
        return // The subscription will fire again with the new tab
      }
      
      setTabs(currentTabs)
      setActiveTab(currentActiveTab)
    })

    // Initial load
    const initialTabs = manager.getTabs()
    const initialActiveTab = manager.getActiveTab()
    
    // Create default tab if no tabs exist
    if (initialTabs.length === 0) {
      manager.addTab({
        id: 'overview',
        title: 'Overview',
        type: 'custom',
        url: `/workspace/${workspaceId}`,
        icon: 'home',
        workspaceId
      })
    }
    
    setTabs(manager.getTabs())
    setActiveTab(manager.getActiveTab())

    return () => {
      unsubscribe()
      manager.destroy()
    }
  }, [workspaceId])

  const contextValue: TabContextType = {
    tabManager,
    activeTab,
    tabs,
    registerNavigationHandler,
    triggerNavigation,
    tabActions,
    setTabActions,
    tabHeaderContent,
    setTabHeaderContent
  }

  return (
    <TabContext.Provider value={contextValue}>
      {children}
    </TabContext.Provider>
  )
}