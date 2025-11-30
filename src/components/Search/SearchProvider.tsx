"use client"

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'

// Hub context types for contextual search
export interface HubSearchContext {
  hubType: 'applications' | 'activities' | 'requests' | 'data' | 'people' | 'workspace'
  hubId?: string
  hubName: string
  placeholder: string
  // Hub-specific quick actions
  actions: HubAction[]
  // Function to search within the hub
  onSearch?: (query: string) => void
  // Hub-specific result transformer
  searchEndpoint?: string
}

export interface HubAction {
  id: string
  label: string
  icon: React.ComponentType<any>
  shortcut?: string
  action: () => void
}

interface SearchContextType {
  isDropdownOpen: boolean
  isPanelOpen: boolean
  query: string
  searchScope: 'hub' | 'workspace'
  hubContext: HubSearchContext | null
  openDropdown: () => void
  closeDropdown: () => void
  openPanel: () => void
  closePanel: () => void
  setQuery: (query: string) => void
  expandToPanel: () => void
  setSearchScope: (scope: 'hub' | 'workspace') => void
  setHubContext: (context: HubSearchContext | null) => void
}

const SearchContext = createContext<SearchContextType | undefined>(undefined)

export function SearchProvider({ children }: { children: ReactNode }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [query, setQueryState] = useState('')
  const [searchScope, setSearchScopeState] = useState<'hub' | 'workspace'>('hub')
  const [hubContext, setHubContextState] = useState<HubSearchContext | null>(null)

  const openDropdown = useCallback(() => {
    setIsDropdownOpen(true)
    setIsPanelOpen(false)
  }, [])

  const closeDropdown = useCallback(() => {
    setIsDropdownOpen(false)
  }, [])

  const openPanel = useCallback(() => {
    setIsPanelOpen(true)
    setIsDropdownOpen(false)
  }, [])

  const closePanel = useCallback(() => {
    setIsPanelOpen(false)
    setQueryState('')
  }, [])

  const setQuery = useCallback((q: string) => {
    setQueryState(q)
    if (q.trim()) {
      setIsDropdownOpen(true)
    }
  }, [])

  const expandToPanel = useCallback(() => {
    setIsDropdownOpen(false)
    setIsPanelOpen(true)
  }, [])

  const setSearchScope = useCallback((scope: 'hub' | 'workspace') => {
    setSearchScopeState(scope)
  }, [])

  const setHubContext = useCallback((context: HubSearchContext | null) => {
    setHubContextState(context)
    // Reset to hub scope when context changes
    if (context) {
      setSearchScopeState('hub')
    }
  }, [])

  return (
    <SearchContext.Provider
      value={{
        isDropdownOpen,
        isPanelOpen,
        query,
        searchScope,
        hubContext,
        openDropdown,
        closeDropdown,
        openPanel,
        closePanel,
        setQuery,
        expandToPanel,
        setSearchScope,
        setHubContext,
      }}
    >
      {children}
    </SearchContext.Provider>
  )
}

export function useSearch() {
  const context = useContext(SearchContext)
  if (context === undefined) {
    throw new Error('useSearch must be used within a SearchProvider')
  }
  return context
}

// Safe version of useSearch that returns null when outside provider
export function useSearchSafe() {
  const context = useContext(SearchContext)
  return context ?? null
}

// Hook to register hub context
export function useHubSearch(context: HubSearchContext) {
  const { setHubContext } = useSearch()
  
  React.useEffect(() => {
    setHubContext(context)
    return () => setHubContext(null)
  }, [context.hubType, context.hubId, context.hubName, setHubContext])
}
