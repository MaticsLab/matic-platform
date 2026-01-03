"use client"

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { 
  Search, 
  Command, 
  Loader2, 
  Sparkles,
  Table2,
  FileText,
  Rows3,
  Inbox,
  GitCompare,
  Layout,
  Zap,
  Plus,
  CornerDownLeft,
  PanelRightOpen,
  Globe,
  ChevronDown,
  GraduationCap,
  Users
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSearch } from './SearchProvider'
import { performSemanticSearch } from '@/lib/api/semantic-search-client'
import { isReportQueryLocal } from '@/lib/api/reports-client'
import type { SemanticSearchResult } from '@/types/search'
import type { TabManager } from '@/lib/tab-manager'

interface SearchBarProps {
  workspaceId?: string
  workspaceSlug?: string
  tabManager?: TabManager | null
  onExpandToPanel: () => void
}

interface SearchResult {
  id: string
  title: string
  subtitle?: string
  icon: React.ComponentType<any>
  type: string
  category: string
  action: () => void
  isAI?: boolean
  badge?: string
}

export function SearchBar({ workspaceId, workspaceSlug, tabManager, onExpandToPanel }: SearchBarProps) {
  const { 
    query, 
    setQuery, 
    isDropdownOpen, 
    openDropdown, 
    closeDropdown,
    searchScope,
    setSearchScope,
    hubContext 
  } = useSearch()
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isSemanticEnabled, setIsSemanticEnabled] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Navigate using tab manager
  const navigateTo = useCallback((url: string, title: string, type: 'table' | 'form' | 'custom' = 'custom') => {
    if (tabManager && workspaceId) {
      tabManager.addTab({
        title,
        url,
        type,
        workspaceId,
      })
    }
    closeDropdown()
    setQuery('')
  }, [tabManager, workspaceId, closeDropdown, setQuery])

  // Get placeholder text based on context
  const getPlaceholder = () => {
    if (hubContext && searchScope === 'hub') {
      return hubContext.placeholder
    }
    return 'Search activities, requests, staff...'
  }

  // Get hub-specific actions
  const getHubActions = useCallback((): SearchResult[] => {
    if (!hubContext || searchScope !== 'hub') return []
    
    return hubContext.actions.map(action => ({
      id: action.id,
      title: action.label,
      icon: action.icon,
      type: 'action',
      category: `${hubContext.hubName} Actions`,
      action: action.action,
      badge: action.shortcut
    }))
  }, [hubContext, searchScope])

  // Get default workspace actions
  const getWorkspaceActions = useCallback((): SearchResult[] => {
    if (!workspaceSlug) return []

    return [
      {
        id: 'create-table',
        title: 'Create new table',
        subtitle: 'Add a data table to your workspace',
        icon: Plus,
        type: 'action',
        category: 'Quick Actions',
        action: () => navigateTo(`/workspace/${workspaceSlug}/tables?action=create`, 'New Table', 'custom')
      },
      {
        id: 'create-form',
        title: 'Create new form',
        subtitle: 'Build a form to collect data',
        icon: Plus,
        type: 'action',
        category: 'Quick Actions',
        action: () => navigateTo(`/workspace/${workspaceSlug}/forms?action=create`, 'New Form', 'custom')
      },
      {
        id: 'nav-tables',
        title: 'Data Hub',
        subtitle: 'View all tables',
        icon: Table2,
        type: 'navigation',
        category: 'Navigate',
        action: () => navigateTo(`/workspace/${workspaceSlug}/tables`, 'Data Hub', 'custom')
      },
      {
        id: 'nav-activities',
        title: 'Activities Hub',
        subtitle: 'Manage activities and events',
        icon: Layout,
        type: 'navigation',
        category: 'Navigate',
        action: () => navigateTo(`/workspace/${workspaceSlug}/activities-hubs`, 'Activities Hub', 'custom')
      },
      {
        id: 'nav-applications',
        title: 'Applications Hub',
        subtitle: 'Manage scholarships and applications',
        icon: GraduationCap,
        type: 'navigation',
        category: 'Navigate',
        action: () => navigateTo(`/workspace/${workspaceSlug}/applications`, 'Applications Hub', 'custom')
      },
      {
        id: 'nav-requests',
        title: 'Request Hub',
        subtitle: 'Handle requests and submissions',
    ]
  }, [workspaceSlug, navigateTo])

  // Get default results based on scope
  const getDefaultResults = useCallback((): SearchResult[] => {
    if (searchScope === 'hub' && hubContext) {
      return getHubActions()
    }
    return getWorkspaceActions()
  }, [searchScope, hubContext, getHubActions, getWorkspaceActions])

  // Icon helper
  const getIconForType = (entityType: string, hubType?: string): React.ComponentType<any> => {
    // Hub-specific icons
    if (hubType === 'applications') return GraduationCap
    if (hubType === 'activities') return Layout
    if (hubType === 'request') return Inbox
    
    // Entity type icons
    switch (entityType) {
      case 'table': return Table2
      case 'form': return FileText
      case 'row': return Rows3
      case 'submission': return Inbox
      case 'workflow': return GitCompare
      case 'stage': return GitCompare
      case 'rubric': return FileText
      default: return Table2
    }
  }

  // Get category name from hub type
  const getCategoryName = (hubType?: string): string => {
    switch (hubType) {
      case 'applications': return 'Applications Hub'
      case 'activities': return 'Activities Hub'
      case 'data': return 'Data Hub'
      default: return 'Results'
    }
  }

  // Detect AI action
  const detectAIAction = useCallback((q: string): SearchResult | null => {
    const lowerQuery = q.toLowerCase()
    
    if (/^(create|add|new|make)\s+(a\s+)?(table|data\s*table)/i.test(lowerQuery)) {
      return {
        id: 'ai-create-table',
        title: 'Create a new table',
        subtitle: 'I\'ll help you set up a table',
        icon: Zap,
        type: 'ai-action',
        category: 'AI Suggestion',
        isAI: true,
        action: () => navigateTo(`/workspace/${workspaceSlug}/tables?action=create`, 'New Table', 'custom')
      }
    }
    
    if (/^(create|add|new|make|build)\s+(a\s+)?(form|survey)/i.test(lowerQuery)) {
      return {
        id: 'ai-create-form',
        title: 'Create a new form',
        subtitle: 'I\'ll help you build a form',
        icon: Zap,
        type: 'ai-action',
        category: 'AI Suggestion',
        isAI: true,
        action: () => navigateTo(`/workspace/${workspaceSlug}/forms?action=create`, 'New Form', 'custom')
      }
    }

    return null
  }, [workspaceSlug, navigateTo])

  // Navigate to search result
  const navigateToResult = useCallback((result: SemanticSearchResult) => {
    if (!workspaceSlug) return
    
    let url = ''
    let title = result.title
    let type: 'table' | 'form' | 'custom' = 'custom'
    
    // Route based on hub type first, then entity type
    if (result.hubType === 'applications') {
      // Applications hub content - route to applications hub
      switch (result.entityType) {
        case 'form':
          // Forms in applications hub should open within the hub
          url = `/workspace/${workspaceSlug}/applications?form=${result.entityId}`
          title = `${result.title} | Applications`
          break
        case 'submission':
          // Submissions in applications hub
          url = `/workspace/${workspaceSlug}/applications?form=${result.tableId}&submission=${result.entityId}`
          title = `${result.title} | Applications`
          break
        case 'workflow':
        case 'stage':
        case 'rubric':
          // Workflow-related items route to applications hub
          url = `/workspace/${workspaceSlug}/applications?workflow=${result.entityId}`
          title = `${result.title} | Applications`
          break
        default:
          url = `/workspace/${workspaceSlug}/applications`
          title = 'Applications Hub'
      }
    } else if (result.hubType === 'activities') {
      // Activities hub content
      url = `/workspace/${workspaceSlug}/activities-hubs/${result.entityId}`
      title = `${result.title} | Activities`
    } else {
      // Default routing based on entity type
      switch (result.entityType) {
        case 'table':
          url = `/workspace/${workspaceSlug}/table/${result.entityId}`
          type = 'table'
          break
        case 'form':
          url = `/workspace/${workspaceSlug}/forms/${result.entityId}`
          type = 'form'
          break
        case 'row':
          if (result.tableId) {
            url = `/workspace/${workspaceSlug}/table/${result.tableId}?row=${result.entityId}`
            type = 'table'
          }
          break
        case 'submission':
          url = `/workspace/${workspaceSlug}/forms/${result.tableId}/submissions/${result.entityId}`
          type = 'form'
          break
        default:
          url = `/workspace/${workspaceSlug}`
      }
    }
    
    navigateTo(url, title, type)
  }, [workspaceSlug, navigateTo])

  // Filter results by query using fuzzy matching
  const filterByQuery = useCallback((items: SearchResult[], searchQuery: string): SearchResult[] => {
    if (!searchQuery.trim()) return items
    
    const query = searchQuery.toLowerCase()
    
    return items.filter(result => {
      const title = result.title.toLowerCase()
      const subtitle = (result.subtitle || '').toLowerCase()
      const searchText = `${title} ${subtitle}`
      
      // Check if query is a prefix of any word
      const words = searchText.split(/\s+/)
      const matchesPrefix = words.some(word => word.startsWith(query))
      
      // Check if query is contained anywhere
      const containsQuery = searchText.includes(query)
      
      // Check fuzzy match - all characters in order
      let queryIdx = 0
      for (const char of searchText) {
        if (char === query[queryIdx]) {
          queryIdx++
          if (queryIdx === query.length) break
        }
      }
      const fuzzyMatch = queryIdx === query.length
      
      return matchesPrefix || containsQuery || fuzzyMatch
    }).sort((a, b) => {
      // Prioritize exact prefix matches
      const aTitle = a.title.toLowerCase()
      const bTitle = b.title.toLowerCase()
      const aStartsWith = aTitle.startsWith(query) ? 0 : 1
      const bStartsWith = bTitle.startsWith(query) ? 0 : 1
      return aStartsWith - bStartsWith
    })
  }, [])

  // Perform search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults(getDefaultResults())
      setIsSemanticEnabled(false)
      return
    }

    // Immediately show filtered actions (instant feedback)
    const defaultResults = getDefaultResults()
    const filteredDefaults = filterByQuery(defaultResults, searchQuery)
    
    // Check for AI action
    const aiAction = detectAIAction(searchQuery)
    
    // Check for report query
    const isReport = isReportQueryLocal(searchQuery)
    const expandOption: SearchResult | null = isReport ? {
      id: 'expand-report',
      title: 'Generate AI Report',
      subtitle: `"${searchQuery}"`,
      icon: Sparkles,
      type: 'expand',
      category: 'AI',
      isAI: true,
      action: () => onExpandToPanel()
    } : null

    // Show instant results while loading
    const instantResults = [
      ...(expandOption ? [expandOption] : []),
      ...(aiAction ? [aiAction] : []),
      ...filteredDefaults
    ]
    
    if (instantResults.length > 0) {
      setResults(instantResults)
      setSelectedIndex(0)
    }

    // Now fetch semantic search results in background
    setIsLoading(true)
    
    try {
      // If hub context has its own search, trigger it
      if (searchScope === 'hub' && hubContext?.onSearch) {
        hubContext.onSearch(searchQuery)
      }

      // Perform semantic search (for workspace scope or as fallback)
      let semanticResults: SearchResult[] = []
      if (workspaceId && (searchScope === 'workspace' || !hubContext?.onSearch)) {
        try {
          const searchOptions: any = { limit: 8 }
          
          // Filter by hub type if in hub scope
          if (searchScope === 'hub' && hubContext?.hubType) {
            searchOptions.hubType = hubContext.hubType
          }
          
          const { results: apiResults, isSemanticEnabled: semantic } = 
            await performSemanticSearch(workspaceId, searchQuery, searchOptions)
          
          setIsSemanticEnabled(semantic)
          
          semanticResults = apiResults.map((r: SemanticSearchResult) => ({
            id: r.entityId,
            title: r.title,
            subtitle: r.subtitle || r.contentSnippet,
            icon: getIconForType(r.entityType, r.hubType),
            type: r.entityType,
            category: searchScope === 'hub' ? hubContext?.hubName || 'Results' : getCategoryName(r.hubType),
            badge: searchScope === 'workspace' ? r.hubType : undefined,
            action: () => navigateToResult(r)
          }))
        } catch (error) {
          console.warn('Semantic search unavailable')
          setIsSemanticEnabled(false)
        }
      }

      // Combine all results - semantic first, then actions
      const allResults = [
        ...(expandOption ? [expandOption] : []),
        ...(aiAction ? [aiAction] : []),
        ...semanticResults,
        ...filteredDefaults.slice(0, semanticResults.length > 0 ? 3 : 6)
      ]
      
      setResults(allResults.length > 0 ? allResults : instantResults)
      setSelectedIndex(0)
      
    } catch (error) {
      console.error('Search error:', error)
      // Keep instant results on error
    } finally {
      setIsLoading(false)
    }
  }, [getDefaultResults, filterByQuery, workspaceId, searchScope, hubContext, detectAIAction, navigateToResult, onExpandToPanel])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query)
    }, 150)
    return () => clearTimeout(timer)
  }, [query, performSearch])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Global ⌘K shortcut
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        openDropdown()
      }

      // Handle navigation when dropdown is open
      if (isDropdownOpen) {
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault()
            setSelectedIndex(prev => Math.min(prev + 1, results.length - 1))
            break
          case 'ArrowUp':
            e.preventDefault()
            setSelectedIndex(prev => Math.max(prev - 1, 0))
            break
          case 'Enter':
            e.preventDefault()
            if (results[selectedIndex]) {
              results[selectedIndex].action()
            }
            break
          case 'Escape':
            closeDropdown()
            inputRef.current?.blur()
            setQuery('')
            break
          case 'Tab':
            if (e.shiftKey) {
              e.preventDefault()
              onExpandToPanel()
            }
            break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDropdownOpen, results, selectedIndex, openDropdown, closeDropdown, setQuery, onExpandToPanel])

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeDropdown()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [closeDropdown])

  // Group results by category
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.category]) acc[result.category] = []
    acc[result.category].push(result)
    return acc
  }, {} as Record<string, SearchResult[]>)

  // Toggle scope
  const toggleScope = () => {
    setSearchScope(searchScope === 'hub' ? 'workspace' : 'hub')
    setQuery('')
    setResults(getDefaultResults())
  }

  return (
    <div ref={containerRef} className="relative flex-1 max-w-xl">
      {/* Search Input */}
      <div className="relative flex items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={openDropdown}
            placeholder={getPlaceholder()}
            className="w-full pl-10 pr-24 h-10 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:border-blue-300 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {isLoading && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
            {isSemanticEnabled && !isLoading && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-50 border border-purple-100">
                <Sparkles className="w-3 h-3 text-purple-500" />
              </div>
            )}
            <div className="hidden sm:flex items-center gap-0.5 text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
              <Command className="w-3 h-3" />
              <span>K</span>
            </div>
          </div>
        </div>
      </div>

      {/* Dropdown Results */}
      {isDropdownOpen && (
        <div 
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden z-50"
        >
          {/* Scope indicator */}
          {hubContext && (
            <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {searchScope === 'hub' 
                  ? `Searching in ${hubContext.hubName}` 
                  : 'Searching entire workspace'}
              </span>
              <button
                onClick={toggleScope}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                {searchScope === 'hub' ? (
                  <>
                    <Globe className="w-3 h-3" />
                    Search workspace
                  </>
                ) : (
                  <>
                    <Layout className="w-3 h-3" />
                    Search {hubContext.hubName}
                  </>
                )}
              </button>
            </div>
          )}

          <div className="max-h-[400px] overflow-y-auto py-2">
            {Object.entries(groupedResults).map(([category, categoryResults]) => (
              <div key={category}>
                <div className="px-3 py-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  {category}
                </div>
                {categoryResults.map((result) => {
                  const globalIndex = results.indexOf(result)
                  const Icon = result.icon
                  
                  return (
                    <button
                      key={result.id}
                      onClick={() => result.action()}
                      className={cn(
                        "w-full px-3 py-2 flex items-center gap-3 text-left transition-colors",
                        globalIndex === selectedIndex 
                          ? "bg-gray-50" 
                          : "hover:bg-gray-50"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                        result.isAI 
                          ? "bg-gradient-to-br from-purple-100 to-blue-100" 
                          : "bg-gray-100"
                      )}>
                        <Icon className={cn(
                          "w-4 h-4",
                          result.isAI ? "text-purple-600" : "text-gray-500"
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {result.title}
                          </span>
                          {result.badge && (
                            <span className="px-1.5 py-0.5 text-xs rounded bg-gray-100 text-gray-500">
                              {result.badge}
                            </span>
                          )}
                        </div>
                        {result.subtitle && (
                          <p className="text-xs text-gray-500 truncate">{result.subtitle}</p>
                        )}
                      </div>
                      {globalIndex === selectedIndex && (
                        <CornerDownLeft className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
            
            {results.length === 0 && !isLoading && (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-gray-500">No results found</p>
                <p className="text-xs text-gray-400 mt-1">Try a different search term</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-400">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-white border border-gray-200 text-gray-500 text-[10px]">↑↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-white border border-gray-200 text-gray-500 text-[10px]">↵</kbd>
                select
              </span>
            </div>
            <button
              onClick={onExpandToPanel}
              className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-200 transition-colors text-gray-500 hover:text-gray-700"
            >
              <PanelRightOpen className="w-3.5 h-3.5" />
              <span>Expand</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
