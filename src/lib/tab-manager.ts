/**
 * Enhanced Tab Manager v2
 * Manages workspace tabs with improved URL-based routing and state sync
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
  isPinned?: boolean // Pinned tabs can't be closed
}

type TabChangeListener = () => void

export class TabManager {
  private workspaceId: string
  private listeners: Set<TabChangeListener> = new Set()
  private storageKey: string
  private readonly PORTALS_TAB_ID = 'portals-hub'

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId
    this.storageKey = `workspace_tabs_${workspaceId}`
    
    // Migrate old tabs to new format
    this.migrateOldTabs()
    
    // Initialize with Portals Hub tab if no tabs exist
    const tabs = this.getTabs()
    if (tabs.length === 0) {
      this.createPortalsHubTab()
    }

    // Listen for storage changes from other tabs
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.handleStorageChange)
    }
  }

  /**
   * Migrate old tab format to new format
   * - Convert old "applications" id to "portals-hub"
   * - Remove duplicate Portals tabs
   * - Update title from "Programs" to "Portals"
   */
  private migrateOldTabs() {
    const { tabs, activeTabId } = this.getStorage()
    if (tabs.length === 0) return

    let needsUpdate = false
    const baseWorkspaceUrl = `/workspace/${this.workspaceId}`
    
    // Find all tabs that point to the applications hub
    const appHubTabs = tabs.filter(t => {
      const [path] = t.url.split('?')
      const normalizedPath = path.replace(/\/$/, '')
      // Match both old /applications route and base workspace with applications view
      return normalizedPath === baseWorkspaceUrl || 
             normalizedPath === `${baseWorkspaceUrl}/applications`
    })

    if (appHubTabs.length > 0) {
      // Keep only the first one, convert it to the new format
      const primaryTab = appHubTabs[0]
      
      // Update the primary tab
      primaryTab.id = this.PORTALS_TAB_ID
      primaryTab.title = 'Portals'
      primaryTab.url = baseWorkspaceUrl
      primaryTab.isPinned = true
      primaryTab.metadata = { view: 'applications' }
      needsUpdate = true

      // Remove duplicates
      for (let i = 1; i < appHubTabs.length; i++) {
        const index = tabs.indexOf(appHubTabs[i])
        if (index > -1) {
          tabs.splice(index, 1)
        }
      }
    }

    if (needsUpdate) {
      this.setStorage({ tabs, activeTabId })
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

  private createPortalsHubTab(): TabData {
    return this.addTab({
      id: this.PORTALS_TAB_ID,
      title: 'Portals',
      url: `/workspace/${this.workspaceId}`,
      type: 'custom',
      workspaceId: this.workspaceId,
      isPinned: true,
      metadata: { view: 'applications' }
    })
  }

  getTabs(): TabData[] {
    const { tabs } = this.getStorage()
    return tabs
  }

  getActiveTab(): TabData | null {
    const { tabs, activeTabId } = this.getStorage()
    if (!activeTabId) return tabs[0] || null
    return tabs.find(tab => tab.id === activeTabId) || tabs[0] || null
  }

  /**
   * Add a new tab or activate existing one
   * Uses URL as the unique identifier - if a tab with the same URL exists, it activates it
   */
  addTab(tab: Omit<TabData, 'lastAccessed'> & { id?: string }): TabData {
    const { tabs } = this.getStorage()
    
    // Normalize URL by removing trailing slashes and query params for comparison
    const normalizeUrl = (url: string) => {
      const [path] = url.split('?')
      return path.replace(/\/$/, '')
    }
    
    const newUrl = tab.url
    const newUrlNormalized = normalizeUrl(newUrl)
    
    // Special handling for Portals Hub - always use the same tab ID
    const isApplicationsHub = newUrlNormalized === normalizeUrl(`/workspace/${this.workspaceId}`) && 
      (!tab.metadata || tab.metadata.view === 'applications' || !tab.metadata.formId)
    
    if (isApplicationsHub) {
      const existingHub = tabs.find(t => t.id === this.PORTALS_TAB_ID)
      if (existingHub) {
        // Update the existing hub tab with new URL (preserves query params)
        existingHub.url = newUrl
        existingHub.lastAccessed = Date.now()
        this.setStorage({ tabs, activeTabId: existingHub.id })
        this.triggerUrlChange(existingHub)
        return existingHub
      }
    }
    
    // For other tabs, check if exact URL match exists (including query params)
    const existingTab = tabs.find(t => t.url === newUrl)
    if (existingTab) {
      existingTab.lastAccessed = Date.now()
      // Update metadata if provided
      if (tab.metadata) {
        existingTab.metadata = { ...existingTab.metadata, ...tab.metadata }
      }
      this.setStorage({ tabs, activeTabId: existingTab.id })
      this.triggerUrlChange(existingTab)
      return existingTab
    }

    // Create new tab
    const newTab: TabData = {
      id: tab.id || `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: tab.title,
      url: newUrl,
      type: tab.type,
      icon: tab.icon,
      workspaceId: this.workspaceId,
      metadata: tab.metadata,
      lastAccessed: Date.now(),
      isPinned: tab.isPinned || false
    }

    tabs.push(newTab)
    this.setStorage({ tabs, activeTabId: newTab.id })
    this.triggerUrlChange(newTab)
    return newTab
  }

  private triggerUrlChange(tab: TabData) {
    // Dispatch custom event that TabNavigation can listen to
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tab-url-change', { detail: { url: tab.url } }))
    }
  }

  closeTab(tabId: string) {
    const { tabs, activeTabId } = this.getStorage()
    const index = tabs.findIndex(tab => tab.id === tabId)
    
    if (index === -1) return

    const tab = tabs[index]
    
    // Don't allow closing pinned tabs
    if (tab.isPinned) {
      console.log('Cannot close pinned tab:', tab.title)
      return
    }

    // Don't allow closing the last tab
    if (tabs.length === 1) {
      console.log('Cannot close the last tab')
      return
    }

    tabs.splice(index, 1)
    
    // If we closed the active tab, activate the next one (or previous if it was the last)
    let newActiveTabId = activeTabId
    if (activeTabId === tabId) {
      const nextIndex = Math.min(index, tabs.length - 1)
      const nextTab = tabs[nextIndex]
      newActiveTabId = nextTab?.id || null
    }

    this.setStorage({ tabs, activeTabId: newActiveTabId })
  }

  setActiveTab(tabId: string) {
    const { tabs, activeTabId } = this.getStorage()
    const tab = tabs.find(t => t.id === tabId)
    
    if (!tab) {
      console.warn('Tab not found:', tabId)
      return
    }

    // Update lastAccessed
    tab.lastAccessed = Date.now()
    
    this.setStorage({ tabs, activeTabId: tabId })
  }

  updateTab(tabId: string, updates: Partial<TabData>) {
    const { tabs, activeTabId } = this.getStorage()
    const tab = tabs.find(t => t.id === tabId)
    
    if (!tab) return

    // Don't allow unpinning the Portals Hub
    if (tab.id === this.PORTALS_TAB_ID && updates.isPinned === false) {
      delete updates.isPinned
    }

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

  /**
   * Navigate to a URL by creating/activating a tab
   */
  navigateToUrl(url: string, title: string, type: TabData['type'] = 'custom', metadata?: Record<string, any>) {
    return this.addTab({
      id: `${this.workspaceId}-${type}-${url.replace(/[^a-zA-Z0-9]/g, '-')}`,
      title,
      url,
      type,
      workspaceId: this.workspaceId,
      metadata
    })
  }

  /**
   * Open the Portals Hub (home view of all portals)
   */
  openPortalsHub() {
    return this.addTab({
      id: this.PORTALS_TAB_ID,
      title: 'Portals',
      url: `/workspace/${this.workspaceId}`,
      type: 'custom',
      workspaceId: this.workspaceId,
      isPinned: true,
      metadata: { view: 'applications' }
    })
  }

  /**
   * Open a specific portal in a new tab
   */
  openPortal(portalId: string, portalName: string) {
    return this.addTab({
      id: `${this.workspaceId}-portal-${portalId}`,
      title: portalName,
      url: `/workspace/${this.workspaceId}?formId=${portalId}`,
      type: 'custom',
      workspaceId: this.workspaceId,
      metadata: {
        view: 'applications',
        formId: portalId,
        portalName
      }
    })
  }
}

// Export YjsTabManager as alias for backwards compatibility
export const YjsTabManager = TabManager

