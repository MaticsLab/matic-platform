'use client'

import React, { useState, useEffect, createContext, useContext } from 'react'
import { TabManager, TabData } from '@/lib/tab-manager'

interface TabContextType {
  tabManager: TabManager | null
  activeTab: TabData | null
  tabs: TabData[]
}

const TabContext = createContext<TabContextType>({
  tabManager: null,
  activeTab: null,
  tabs: []
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

  // Initialize tab manager
  useEffect(() => {
    const manager = new TabManager(workspaceId)
    setTabManager(manager)

    // Subscribe to tab changes
    const unsubscribe = manager.subscribe(() => {
      const currentTabs = manager.getTabs()
      const currentActiveTab = manager.getActiveTab()
      
      // Remove duplicate Activities Hub tabs if they exist
      const activitiesHubUrl = `/workspace/${workspaceId}/activities-hubs`
      const activitiesHubTabs = currentTabs.filter(tab => tab.url === activitiesHubUrl && tab.type === 'custom')
      if (activitiesHubTabs.length > 1) {
        // Keep the first one, remove the rest
        for (let i = 1; i < activitiesHubTabs.length; i++) {
          manager.closeTab(activitiesHubTabs[i].id)
        }
        return // Subscription will fire again with updated tabs
      }
      
      // Auto-create Activities Hub tab if all tabs are closed
      if (currentTabs.length === 0) {
        manager.addTab({
          title: 'Activities Hub',
          type: 'custom',
          url: `/workspace/${workspaceId}/activities-hubs`,
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
    
    // Create default tab if no tabs exist - use Activities Hub instead of Overview
    if (initialTabs.length === 0) {
      // Check if Activities Hub tab already exists
      const activitiesHubUrl = `/workspace/${workspaceId}/activities-hubs`
      const existingActivitiesHub = initialTabs.find(tab => tab.url === activitiesHubUrl && tab.type === 'custom')
      
      if (!existingActivitiesHub) {
        manager.addTab({
          title: 'Activities Hub',
          type: 'custom',
          url: activitiesHubUrl,
          workspaceId
        })
      }
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
    tabs
  }

  return (
    <TabContext.Provider value={contextValue}>
      {children}
    </TabContext.Provider>
  )
}