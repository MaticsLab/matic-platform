/**
 * Simplified Tab Manager
 * Manages workspace tabs using localStorage instead of Yjs
 * For multi-user real-time sync, we can add Yjs later
 */

export interface TabData {
  id: string
  title: string
  url: string
  type: 'form' | 'table' | 'calendar' | 'project' | 'workflow' | 'custom'
  icon?: string
  workspaceId: string
  metadata?: Record<string, any>
  lastAccessed: number
}

type TabChangeListener = () => void

export class TabManager {
  private workspaceId: string
  private listeners: Set<TabChangeListener> = new Set()
  private storageKey: string

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId
    this.storageKey = `workspace_tabs_${workspaceId}`
    
    // Initialize with Applications Hub tab if no tabs exist
    const tabs = this.getTabs()
    if (tabs.length === 0) {
      this.addTab({
        id: 'applications',
        title: 'Programs',
        url: `/workspace/${workspaceId}/applications`,
        type: 'custom',
        workspaceId
      })
    }

    // Listen for storage changes from other tabs
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.handleStorageChange)
    }
  }

  private handleStorageChange = (e: StorageEvent) => {
    if (e.key === this.storageKey) {
      this.notifyListeners()
    }
  }

  private getStorage(): { tabs: TabData[], activeTabId: string | null } {
    if (typeof window === 'undefined') {
      return { tabs: [], activeTabId: null }
    }

    try {
      const data = localStorage.getItem(this.storageKey)
      if (!data) {
        return { tabs: [], activeTabId: null }
      }
      return JSON.parse(data)
    } catch {
      return { tabs: [], activeTabId: null }
    }
  }

  private setStorage(data: { tabs: TabData[], activeTabId: string | null }) {
    if (typeof window === 'undefined') return
    
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data))
      this.notifyListeners()
    } catch (error) {
      console.error('Failed to save tabs to localStorage:', error)
    }
  }

  getTabs(): TabData[] {
    const { tabs } = this.getStorage()
    return tabs // Keep original order, don't sort
  }

  getActiveTab(): TabData | null {
    const { tabs, activeTabId } = this.getStorage()
    if (!activeTabId) return tabs[0] || null
    return tabs.find(tab => tab.id === activeTabId) || tabs[0] || null
  }

  addTab(tab: Omit<TabData, 'id' | 'lastAccessed'> & { id?: string }): TabData {
    const { tabs, activeTabId } = this.getStorage()
    
    // Check if tab with same URL already exists
    const existing = tabs.find(t => t.url === tab.url)
    if (existing) {
      this.setActiveTab(existing.id)
      return existing
    }

    const newTab: TabData = {
      id: tab.id || `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: tab.title,
      url: tab.url,
      type: tab.type,
      icon: tab.icon,
      workspaceId: this.workspaceId,
      metadata: tab.metadata,
      lastAccessed: Date.now()
    }

    tabs.push(newTab)
    this.setStorage({ tabs, activeTabId: newTab.id })
    return newTab
  }

  closeTab(tabId: string) {
    const { tabs, activeTabId } = this.getStorage()
    const index = tabs.findIndex(tab => tab.id === tabId)
    
    if (index === -1) return

    // Don't allow closing the last tab
    if (tabs.length === 1) return

    // Don't allow closing the Applications Hub tab (check all possible identifiers)
    const tab = tabs[index]
    const isApplicationsTab = 
      tab.id === 'applications' || 
      (tab.title === 'Programs' && tab.url === `/workspace/${this.workspaceId}/applications`)
    
    if (isApplicationsTab) {
      console.log('Cannot close the Applications Hub tab')
      return
    }

    tabs.splice(index, 1)
    
    // If we closed the active tab, activate the next one
    let newActiveTabId = activeTabId
    if (activeTabId === tabId) {
      const nextTab = tabs[Math.max(0, index - 1)]
      newActiveTabId = nextTab?.id || null
    }

    this.setStorage({ tabs, activeTabId: newActiveTabId })
  }

  setActiveTab(tabId: string) {
    const { tabs, activeTabId } = this.getStorage()
    const tab = tabs.find(t => t.id === tabId)
    
    if (!tab) return

    // Update lastAccessed
    tab.lastAccessed = Date.now()
    
    this.setStorage({ tabs, activeTabId: tabId })
  }

  updateTab(tabId: string, updates: Partial<TabData>) {
    const { tabs, activeTabId } = this.getStorage()
    const tab = tabs.find(t => t.id === tabId)
    
    if (!tab) return

    Object.assign(tab, updates)
    this.setStorage({ tabs, activeTabId })
  }

  subscribe(listener: TabChangeListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener())
  }

  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.handleStorageChange)
    }
    this.listeners.clear()
  }

  // Utility method to navigate and create/activate tab
  navigateToTab(url: string, title: string, type: TabData['type'], metadata?: Record<string, any>) {
    const tab = this.addTab({
      title,
      url,
      type,
      workspaceId: this.workspaceId,
      metadata
    })
    
    return tab
  }
}

// Export YjsTabManager as alias for backwards compatibility
export const YjsTabManager = TabManager
