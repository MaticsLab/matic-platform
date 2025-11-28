"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Search, 
  Hash, 
  FileText, 
  Users, 
  Settings, 
  Plus, 
  Folder,
  Command,
  ArrowRight,
  Clock,
  Star,
  X,
  Table2,
  Inbox,
  Filter,
  Edit,
  Copy,
  Trash2,
  ExternalLink,
  ChevronRight,
  Zap,
  Layout,
  Database,
  CheckSquare,
  Calendar,
  UserCircle2,
  Sparkles,
  GitCompare,
  Rows3
} from 'lucide-react'
import { performSemanticSearch } from '@/lib/api/semantic-search-client'
import type { SemanticSearchResult } from '@/types/search'

interface OmniSearchProps {
  isOpen: boolean
  onClose: () => void
  workspaceId?: string
  workspaceSlug?: string
}

type SearchResultType = 
  | 'table' 
  | 'form' 
  | 'request-hub' 
  | 'row' 
  | 'submission' 
  | 'action' 
  | 'navigation' 
  | 'recent'

interface SearchResult {
  id: string
  title: string
  subtitle?: string
  description?: string
  icon: React.ComponentType<any>
  type: SearchResultType
  category: string
  action: () => void
  secondaryActions?: {
    label: string
    icon: React.ComponentType<any>
    action: () => void
  }[]
  shortcut?: string
  keywords?: string[]
  badge?: string
  timestamp?: string
  path?: string // breadcrumb path
}

export const OmniSearch: React.FC<OmniSearchProps> = ({ 
  isOpen, 
  onClose, 
  workspaceId,
  workspaceSlug 
}) => {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [isSemanticEnabled, setIsSemanticEnabled] = useState(false)
  const [searchTook, setSearchTook] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Load recent searches from localStorage
  useEffect(() => {
    const recent = localStorage.getItem('omnisearch-recent')
    if (recent) {
      setRecentSearches(JSON.parse(recent))
    }
  }, [])

  // Save search to recent
  const saveToRecent = (query: string) => {
    if (!query.trim()) return
    const updated = [query, ...recentSearches.filter(q => q !== query)].slice(0, 5)
    setRecentSearches(updated)
    localStorage.setItem('omnisearch-recent', JSON.stringify(updated))
  }

  // Default actions and navigation items
  const getDefaultResults = useCallback((): SearchResult[] => {
    if (!workspaceSlug) return []

    return [
      // Quick Actions - Create
      {
        id: 'action-new-table',
        title: 'Create New Table',
        subtitle: 'Create a new data table',
        icon: Table2,
        type: 'action',
        category: 'CREATE',
        action: () => {
          router.push(`/workspace/${workspaceSlug}?action=create-table`)
          onClose()
        },
        shortcut: '⌘T',
        keywords: ['create', 'new', 'table', 'database', 'data']
      },
      {
        id: 'action-new-form',
        title: 'Create New Form',
        subtitle: 'Build a form to collect data',
        icon: FileText,
        type: 'action',
        category: 'CREATE',
        action: () => {
          router.push(`/workspace/${workspaceSlug}?action=create-form`)
          onClose()
        },
        shortcut: '⌘F',
        keywords: ['create', 'new', 'form', 'survey', 'application']
      },
      {
        id: 'action-new-workflow',
        title: 'Create Workflow',
        subtitle: 'Set up a review workflow',
        icon: GitCompare,
        type: 'action',
        category: 'CREATE',
        action: () => {
          router.push(`/workspace/${workspaceSlug}/workflows/new`)
          onClose()
        },
        keywords: ['create', 'new', 'workflow', 'review', 'approval', 'stages']
      },
      {
        id: 'action-new-hub',
        title: 'Create Hub',
        subtitle: 'Create an activities or request hub',
        icon: Inbox,
        type: 'action',
        category: 'CREATE',
        action: () => {
          router.push(`/workspace/${workspaceSlug}?action=create-hub`)
          onClose()
        },
        keywords: ['create', 'new', 'hub', 'activities', 'request', 'module']
      },

      // Navigation
      {
        id: 'nav-dashboard',
        title: 'Dashboard',
        subtitle: 'Go to workspace overview',
        icon: Layout,
        type: 'navigation',
        category: 'NAVIGATION',
        action: () => {
          router.push(`/workspace/${workspaceSlug}`)
          onClose()
        },
        keywords: ['dashboard', 'overview', 'home', 'main']
      },
      {
        id: 'nav-tables',
        title: 'All Tables',
        subtitle: 'View and manage data tables',
        icon: Table2,
        type: 'navigation',
        category: 'NAVIGATION',
        action: () => {
          router.push(`/workspace/${workspaceSlug}/tables`)
          onClose()
        },
        keywords: ['tables', 'databases', 'data', 'rows', 'columns']
      },
      {
        id: 'nav-forms',
        title: 'All Forms',
        subtitle: 'View and manage forms',
        icon: FileText,
        type: 'navigation',
        category: 'NAVIGATION',
        action: () => {
          router.push(`/workspace/${workspaceSlug}/forms`)
          onClose()
        },
        keywords: ['forms', 'surveys', 'applications', 'submissions']
      },
      {
        id: 'nav-workflows',
        title: 'Workflows',
        subtitle: 'Manage review workflows',
        icon: GitCompare,
        type: 'navigation',
        category: 'NAVIGATION',
        action: () => {
          router.push(`/workspace/${workspaceSlug}/workflows`)
          onClose()
        },
        keywords: ['workflows', 'review', 'approval', 'stages', 'rubrics']
      },
      {
        id: 'nav-activities-hub',
        title: 'Activities Hub',
        subtitle: 'Manage programs and events',
        icon: Calendar,
        type: 'navigation',
        category: 'NAVIGATION',
        action: () => {
          router.push(`/workspace/${workspaceSlug}/activities`)
          onClose()
        },
        keywords: ['activities', 'programs', 'events', 'attendance', 'hub']
      },
      {
        id: 'nav-request-hub',
        title: 'Request Hub',
        subtitle: 'Manage requests and approvals',
        icon: Inbox,
        type: 'navigation',
        category: 'NAVIGATION',
        action: () => {
          router.push(`/workspace/${workspaceSlug}/request-hub`)
          onClose()
        },
        keywords: ['requests', 'approvals', 'inbox', 'hub']
      },
      {
        id: 'nav-settings',
        title: 'Workspace Settings',
        subtitle: 'Configure workspace preferences',
        icon: Settings,
        type: 'navigation',
        category: 'NAVIGATION',
        action: () => {
          router.push(`/workspace/${workspaceSlug}/settings`)
          onClose()
        },
        keywords: ['settings', 'preferences', 'configuration', 'workspace']
      }
    ]
  }, [workspaceSlug, router, onClose])

  // AI-powered action detection from natural language
  const detectActionFromQuery = useCallback((query: string): SearchResult | null => {
    const lowerQuery = query.toLowerCase()
    
    // Create actions
    if (lowerQuery.match(/^(create|add|new|make)\s+(a\s+)?(table|data\s*table)/i)) {
      return {
        id: 'ai-action-create-table',
        title: '✨ Create a new table',
        subtitle: 'AI detected: You want to create a table',
        icon: Zap,
        type: 'action',
        category: 'AI SUGGESTION',
        action: () => {
          router.push(`/workspace/${workspaceSlug}?action=create-table`)
          onClose()
        }
      }
    }
    
    if (lowerQuery.match(/^(create|add|new|make|build)\s+(a\s+)?(form|survey|application)/i)) {
      return {
        id: 'ai-action-create-form',
        title: '✨ Create a new form',
        subtitle: 'AI detected: You want to create a form',
        icon: Zap,
        type: 'action',
        category: 'AI SUGGESTION',
        action: () => {
          router.push(`/workspace/${workspaceSlug}?action=create-form`)
          onClose()
        }
      }
    }
    
    if (lowerQuery.match(/^(create|add|new|set\s*up)\s+(a\s+)?(workflow|review|approval)/i)) {
      return {
        id: 'ai-action-create-workflow',
        title: '✨ Create a review workflow',
        subtitle: 'AI detected: You want to set up a workflow',
        icon: Zap,
        type: 'action',
        category: 'AI SUGGESTION',
        action: () => {
          router.push(`/workspace/${workspaceSlug}/workflows/new`)
          onClose()
        }
      }
    }

    // Show/View actions
    if (lowerQuery.match(/^(show|view|see|find|list|get)\s+(me\s+)?(all\s+)?(my\s+)?(tables|data)/i)) {
      return {
        id: 'ai-action-show-tables',
        title: '✨ Show all tables',
        subtitle: 'AI detected: You want to see your tables',
        icon: Zap,
        type: 'action',
        category: 'AI SUGGESTION',
        action: () => {
          router.push(`/workspace/${workspaceSlug}/tables`)
          onClose()
        }
      }
    }
    
    if (lowerQuery.match(/^(show|view|see|find|list|get)\s+(me\s+)?(all\s+)?(my\s+)?(forms|applications|surveys)/i)) {
      return {
        id: 'ai-action-show-forms',
        title: '✨ Show all forms',
        subtitle: 'AI detected: You want to see your forms',
        icon: Zap,
        type: 'action',
        category: 'AI SUGGESTION',
        action: () => {
          router.push(`/workspace/${workspaceSlug}/forms`)
          onClose()
        }
      }
    }
    
    if (lowerQuery.match(/^(show|view|see|find|list|get)\s+(me\s+)?(all\s+)?(my\s+)?(submissions|responses|applications)/i)) {
      return {
        id: 'ai-action-show-submissions',
        title: '✨ Show form submissions',
        subtitle: 'AI detected: You want to see submissions',
        icon: Zap,
        type: 'action',
        category: 'AI SUGGESTION',
        action: () => {
          router.push(`/workspace/${workspaceSlug}/forms`)
          onClose()
        }
      }
    }
    
    if (lowerQuery.match(/^(show|view|see|find|list|get)\s+(me\s+)?(all\s+)?(my\s+)?(workflows|reviews)/i)) {
      return {
        id: 'ai-action-show-workflows',
        title: '✨ Show workflows',
        subtitle: 'AI detected: You want to see your workflows',
        icon: Zap,
        type: 'action',
        category: 'AI SUGGESTION',
        action: () => {
          router.push(`/workspace/${workspaceSlug}/workflows`)
          onClose()
        }
      }
    }
    
    if (lowerQuery.match(/^(show|view|see|find|go\s*to)\s+(me\s+)?(the\s+)?(activities|programs|events)/i)) {
      return {
        id: 'ai-action-show-activities',
        title: '✨ Go to Activities Hub',
        subtitle: 'AI detected: You want to see activities',
        icon: Zap,
        type: 'action',
        category: 'AI SUGGESTION',
        action: () => {
          router.push(`/workspace/${workspaceSlug}/activities`)
          onClose()
        }
      }
    }
    
    if (lowerQuery.match(/^(show|view|see|find|go\s*to)\s+(me\s+)?(the\s+)?(requests|inbox)/i)) {
      return {
        id: 'ai-action-show-requests',
        title: '✨ Go to Request Hub',
        subtitle: 'AI detected: You want to see requests',
        icon: Zap,
        type: 'action',
        category: 'AI SUGGESTION',
        action: () => {
          router.push(`/workspace/${workspaceSlug}/request-hub`)
          onClose()
        }
      }
    }

    // Go to actions
    if (lowerQuery.match(/^(go\s*to|open|navigate\s*to)\s+(the\s+)?(dashboard|home|overview)/i)) {
      return {
        id: 'ai-action-go-dashboard',
        title: '✨ Go to Dashboard',
        subtitle: 'AI detected: Navigate to dashboard',
        icon: Zap,
        type: 'action',
        category: 'AI SUGGESTION',
        action: () => {
          router.push(`/workspace/${workspaceSlug}`)
          onClose()
        }
      }
    }
    
    if (lowerQuery.match(/^(go\s*to|open|navigate\s*to)\s+(the\s+)?settings/i)) {
      return {
        id: 'ai-action-go-settings',
        title: '✨ Go to Settings',
        subtitle: 'AI detected: Navigate to settings',
        icon: Zap,
        type: 'action',
        category: 'AI SUGGESTION',
        action: () => {
          router.push(`/workspace/${workspaceSlug}/settings`)
          onClose()
        }
      }
    }

    return null
  }, [workspaceSlug, router, onClose])

  // Search function with semantic search integration
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults(getDefaultResults())
      setIsSemanticEnabled(false)
      setSearchTook(0)
      return
    }

    setIsLoading(true)
    
    try {
      // Check for AI-detected action first
      const aiAction = detectActionFromQuery(searchQuery)
      
      // Get default action/navigation results first
      const defaultResults = getDefaultResults()
      const filteredDefaults = defaultResults.filter(result => {
        const searchTerms = searchQuery.toLowerCase().split(' ')
        const searchableText = [
          result.title,
          result.subtitle,
          result.description,
          result.category,
          ...(result.keywords || [])
        ].join(' ').toLowerCase()
        
        return searchTerms.every(term => searchableText.includes(term))
      })

      // Perform semantic search if workspace is available
      let semanticResults: SearchResult[] = []
      if (workspaceId) {
        try {
          const { results: apiResults, isSemanticEnabled: semantic, took } = 
            await performSemanticSearch(workspaceId, searchQuery, { limit: 20 })
          
          setIsSemanticEnabled(semantic)
          setSearchTook(took)
          
          // Convert API results to OmniSearch format
          semanticResults = apiResults.map((r: SemanticSearchResult) => ({
            id: r.entityId,
            title: r.title,
            subtitle: r.subtitle || r.contentSnippet,
            description: r.contentSnippet,
            icon: getIconForType(r.entityType, r.hubType),
            type: r.entityType as SearchResultType,
            category: getCategoryForType(r.entityType, r.hubType),
            action: () => {
              navigateToResult(r)
              onClose()
            },
            secondaryActions: getSecondaryActions(r),
            badge: r.hubType,
            path: r.tags?.join(' / '),
          }))
        } catch (error) {
          console.warn('Semantic search unavailable, using local search only')
          setIsSemanticEnabled(false)
        }
      }

      // Combine results: AI action first, then semantic, then filtered defaults
      const allResults = [
        ...(aiAction ? [aiAction] : []),
        ...semanticResults, 
        ...filteredDefaults
      ]
      setResults(allResults)
      
    } catch (error) {
      console.error('Search error:', error)
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [getDefaultResults, workspaceId, onClose])

  // Helper to get icon based on entity type
  const getIconForType = (entityType: string, hubType?: string) => {
    switch (entityType) {
      case 'table': return Table2
      case 'row': return Rows3
      case 'form': return FileText
      case 'submission': return CheckSquare
      case 'column': return Database
      case 'workflow': return GitCompare
      default:
        if (hubType === 'activities') return Calendar
        if (hubType === 'request') return Inbox
        return Database
    }
  }

  // Helper to get category based on entity type
  const getCategoryForType = (entityType: string, hubType?: string) => {
    if (hubType) {
      return hubType.toUpperCase() + ' HUB'
    }
    switch (entityType) {
      case 'table': return 'TABLES'
      case 'row': return 'TABLE DATA'
      case 'form': return 'FORMS'
      case 'submission': return 'SUBMISSIONS'
      case 'workflow': return 'WORKFLOWS'
      default: return 'RESULTS'
    }
  }

  // Navigate to a search result
  const navigateToResult = (r: SemanticSearchResult) => {
    if (!workspaceSlug) return
    
    switch (r.entityType) {
      case 'table':
        router.push(`/workspace/${workspaceSlug}/table/${r.entityId}`)
        break
      case 'row':
        if (r.tableId) {
          router.push(`/workspace/${workspaceSlug}/table/${r.tableId}?row=${r.entityId}`)
        }
        break
      case 'form':
        router.push(`/workspace/${workspaceSlug}/form/${r.entityId}`)
        break
      case 'submission':
        router.push(`/workspace/${workspaceSlug}/submissions/${r.entityId}`)
        break
      default:
        console.log('Navigate to:', r.entityType, r.entityId)
    }
  }

  // Get secondary actions for a result
  const getSecondaryActions = (r: SemanticSearchResult) => {
    const actions = []
    
    // Add "Find Similar" for items with embeddings
    if (['row', 'submission'].includes(r.entityType)) {
      actions.push({
        label: 'Find Similar',
        icon: Sparkles,
        action: () => {
          // This could open a "similar items" view
          console.log('Find similar to:', r.entityId)
        }
      })
    }
    
    return actions.length > 0 ? actions : undefined
  }

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query)
    }, 150)

    return () => clearTimeout(timer)
  }, [query, performSearch])

  // Initialize with default results
  useEffect(() => {
    if (isOpen && !query) {
      setResults(getDefaultResults())
    }
  }, [isOpen, query, getDefaultResults])

  // Group results by category
  const groupedResults = results.reduce((groups, result) => {
    if (!groups[result.category]) {
      groups[result.category] = []
    }
    groups[result.category].push(result)
    return groups
  }, {} as Record<string, SearchResult[]>)

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      switch (e.key) {
        case 'Escape':
          onClose()
          break
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex(prev => 
            prev < results.length - 1 ? prev + 1 : 0
          )
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : results.length - 1
          )
          break
        case 'Enter':
          e.preventDefault()
          if (results[selectedIndex]) {
            saveToRecent(query)
            results[selectedIndex].action()
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, selectedIndex, results, onClose, query])

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setQuery('')
      setSelectedIndex(0)
    }
  }, [isOpen])

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && selectedIndex >= 0) {
      const allResults = listRef.current.querySelectorAll('[data-result]')
      const selectedElement = allResults[selectedIndex] as HTMLElement
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [selectedIndex])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Search Modal */}
      <div className="fixed top-[15%] left-1/2 transform -translate-x-1/2 w-full max-w-2xl z-50 px-4 animate-in slide-in-from-top-4 duration-300">
        <div className="bg-white rounded-xl shadow-2xl border border-gray-200/80 overflow-hidden">
          {/* Search Input */}
          <div className="relative border-b border-gray-100">
            <div className="flex items-center gap-3 px-5 py-4">
              <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search for anything..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent text-gray-900 placeholder-gray-400 outline-none text-[15px]"
                autoFocus
              />
              {isLoading && (
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          </div>

          {/* Results */}
          <div 
            ref={listRef}
            className="max-h-[420px] overflow-y-auto overscroll-contain"
          >
            {results.length === 0 && !isLoading ? (
              <div className="py-20 px-4 text-center">
                <Search className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <p className="text-base font-medium text-gray-900 mb-1">
                  {query ? 'No results found' : 'Start typing to search'}
                </p>
                <p className="text-sm text-gray-500">
                  {query 
                    ? 'Try different keywords or check your spelling'
                    : 'Search across tables, forms, request hubs, and more'
                  }
                </p>
              </div>
            ) : (
              <div className="py-2">
                {Object.entries(groupedResults).map(([category, categoryResults]) => (
                  <div key={category} className="mb-1">
                    {/* Category Header */}
                    <div className="px-4 py-2">
                      <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                        {category}
                      </div>
                    </div>

                    {/* Results */}
                    {categoryResults.map((result) => {
                      const globalIndex = results.indexOf(result)
                      const isSelected = globalIndex === selectedIndex
                      
                      return (
                        <button
                          key={result.id}
                          data-result
                          onClick={() => {
                            saveToRecent(query)
                            result.action()
                          }}
                          className={`w-full group relative flex items-center gap-3 px-4 py-2.5 transition-colors ${
                            isSelected 
                              ? 'bg-gray-100' 
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          {/* Icon */}
                          <div className={`flex-shrink-0 p-2 rounded-md transition-colors ${
                            isSelected 
                              ? 'bg-white' 
                              : 'bg-transparent'
                          }`}>
                            <result.icon className="w-[18px] h-[18px] text-gray-600" />
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 text-left min-w-0">
                            <div className="font-medium text-[14px] text-gray-900 truncate leading-tight">
                              {result.title}
                            </div>
                            {result.subtitle && (
                              <div className="text-[13px] text-gray-500 truncate mt-0.5">
                                {result.subtitle}
                              </div>
                            )}
                          </div>

                          {/* Shortcut */}
                          {result.shortcut && !isSelected && (
                            <kbd className="px-2 py-1 text-[11px] font-medium text-gray-400 bg-gray-50 border border-gray-200 rounded">
                              {result.shortcut}
                            </kbd>
                          )}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 bg-white border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-[11px] text-gray-500">
                <div className="flex items-center gap-1">
                  <span className="text-gray-400">↑↓</span>
                  <span>Navigate</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-400">↵</span>
                  <span>Select</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-400">ESC</span>
                  <span>Close</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {isSemanticEnabled && (
                  <div className="flex items-center gap-1.5 text-[11px] text-purple-600">
                    <Sparkles className="w-3 h-3" />
                    <span>AI Search</span>
                    {searchTook > 0 && (
                      <span className="text-purple-400">({searchTook}ms)</span>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                  <Command className="w-3 h-3" />
                  <span>Command Palette</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
