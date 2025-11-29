"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
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
  Rows3,
  TrendingUp,
  History,
  HelpCircle,
  AlertCircle,
  ListFilter,
  SlidersHorizontal
} from 'lucide-react'
import { performSemanticSearch, semanticSearchClient } from '@/lib/api/semantic-search-client'
import { tablesGoClient } from '@/lib/api/tables-go-client'
import { formsClient } from '@/lib/api/forms-client'
import type { SemanticSearchResult } from '@/types/search'

interface OmniSearchProps {
  isOpen: boolean
  onClose: () => void
  workspaceId?: string
  workspaceSlug?: string
}

// Context detection for contextual actions
type PageContext = 'dashboard' | 'table' | 'form' | 'workflow' | 'hub' | 'settings' | 'other'

// AI Action types
interface AIAction {
  id: string
  title: string
  subtitle: string
  icon: React.ComponentType<any>
  type: 'action'
  category: string
  action: () => void
  confidence: number // 0-1 confidence score
  keywords?: string[]
}

// Filter command parsed result
interface ParsedFilter {
  status?: string[]
  dateField?: string
  dateRange?: { start?: string; end?: string }
  search?: string
  field?: string
  value?: string
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
  const pathname = usePathname()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [popularSearches, setPopularSearches] = useState<Array<{ query: string; count: number }>>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [isSemanticEnabled, setIsSemanticEnabled] = useState(false)
  const [searchTook, setSearchTook] = useState(0)
  const [showSimilarResults, setShowSimilarResults] = useState(false)
  const [similarResults, setSimilarResults] = useState<SearchResult[]>([])
  const [similarSourceTitle, setSimilarSourceTitle] = useState('')
  // Cached workspace data for data-aware actions
  const [cachedTables, setCachedTables] = useState<Array<{ id: string; name: string }>>([])
  const [cachedForms, setCachedForms] = useState<Array<{ id: string; name: string }>>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Detect current page context for contextual actions
  const detectPageContext = useCallback((): PageContext => {
    if (!pathname) return 'other'
    if (pathname.includes('/table/')) return 'table'
    if (pathname.includes('/form/')) return 'form'
    if (pathname.includes('/workflow')) return 'workflow'
    if (pathname.includes('/activities') || pathname.includes('/request-hub')) return 'hub'
    if (pathname.includes('/settings')) return 'settings'
    if (pathname.endsWith(workspaceSlug || '')) return 'dashboard'
    return 'other'
  }, [pathname, workspaceSlug])

  // Load workspace data for data-aware actions
  useEffect(() => {
    const loadWorkspaceData = async () => {
      if (!workspaceId) return
      try {
        const [tables, formsResponse] = await Promise.all([
          tablesGoClient.getTablesByWorkspace(workspaceId).catch(() => []),
          formsClient.list(workspaceId).catch(() => [])
        ])
        // Handle both array and object responses
        const tablesArray = Array.isArray(tables) ? tables : []
        // formsResponse could be array or object with forms/data property
        let formsArray: any[] = []
        if (Array.isArray(formsResponse)) {
          formsArray = formsResponse
        } else if (formsResponse && typeof formsResponse === 'object') {
          formsArray = (formsResponse as any).forms || (formsResponse as any).data || []
        }
        
        setCachedTables(tablesArray.map((t: any) => ({ id: t.id, name: t.name })))
        setCachedForms(Array.isArray(formsArray) ? formsArray.map((f: any) => ({ id: f.id, name: f.name })) : [])
      } catch (error) {
        console.warn('Failed to load workspace data for AI actions')
      }
    }
    if (isOpen) {
      loadWorkspaceData()
    }
  }, [isOpen, workspaceId])

  // Load recent searches from localStorage and server
  useEffect(() => {
    const loadSearchData = async () => {
      // Load from localStorage first (fast)
      const recent = localStorage.getItem('omnisearch-recent')
      if (recent) {
        setRecentSearches(JSON.parse(recent))
      }

      // Load from server if workspace available
      if (workspaceId) {
        try {
          const [recentRes, popularRes] = await Promise.all([
            semanticSearchClient.getRecentSearches(workspaceId, { limit: 5 }),
            semanticSearchClient.getPopularSearches(workspaceId, { limit: 5 })
          ])
          
          // Merge server recent with local
          if (recentRes.searches?.length) {
            const serverRecent = recentRes.searches.map(s => s.query)
            const merged = [...new Set([...serverRecent, ...recentSearches])].slice(0, 5)
            setRecentSearches(merged)
          }
          
          if (popularRes.searches?.length) {
            setPopularSearches(popularRes.searches)
          }
        } catch (error) {
          console.warn('Failed to load search data from server')
        }
      }
    }

    if (isOpen) {
      loadSearchData()
    }
  }, [isOpen, workspaceId])

  // Save search to recent (local + server)
  const saveToRecent = async (searchQuery: string) => {
    if (!searchQuery.trim()) return
    const updated = [searchQuery, ...recentSearches.filter(q => q !== searchQuery)].slice(0, 5)
    setRecentSearches(updated)
    localStorage.setItem('omnisearch-recent', JSON.stringify(updated))

    // Save to server
    if (workspaceId) {
      try {
        await semanticSearchClient.saveSearchHistory(workspaceId, searchQuery, results.length)
      } catch (error) {
        // Silent fail - local storage is primary
      }
    }
  }

  // Fetch suggestions as user types
  useEffect(() => {
    if (!query.trim() || query.length < 2 || !workspaceId) {
      setSuggestions([])
      return
    }

    const fetchSuggestions = async () => {
      try {
        const res = await semanticSearchClient.getSearchSuggestions(workspaceId, query, { limit: 5 })
        setSuggestions(res.suggestions || [])
      } catch {
        setSuggestions([])
      }
    }

    const timer = setTimeout(fetchSuggestions, 100)
    return () => clearTimeout(timer)
  }, [query, workspaceId])

  // Find similar items handler
  const handleFindSimilar = async (entityId: string, entityType: string, title: string) => {
    if (!workspaceId) return
    
    setIsLoading(true)
    setSimilarSourceTitle(title)
    
    try {
      const response = await semanticSearchClient.findSimilar(entityId, entityType as any, { limit: 10 })
      
      const similarItems: SearchResult[] = (response.similarItems || []).map((item: any) => ({
        id: item.entity_id,
        title: item.title,
        subtitle: item.subtitle || `${Math.round(item.similarity * 100)}% similar`,
        icon: getIconForType(item.entity_type),
        type: item.entity_type as SearchResultType,
        category: 'SIMILAR ITEMS',
        action: () => {
          navigateToResult({
            entityId: item.entity_id,
            entityType: item.entity_type,
            tableId: item.table_id,
            title: item.title,
          } as SemanticSearchResult)
          onClose()
        },
        badge: `${Math.round(item.similarity * 100)}%`,
      }))
      
      setSimilarResults(similarItems)
      setShowSimilarResults(true)
    } catch (error) {
      console.error('Find similar failed:', error)
      setSimilarResults([])
    } finally {
      setIsLoading(false)
    }
  }

  // Back to search from similar view
  const backToSearch = () => {
    setShowSimilarResults(false)
    setSimilarResults([])
    setSimilarSourceTitle('')
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
      },
      // Recent searches
      ...recentSearches.slice(0, 3).map((search, i) => ({
        id: `recent-${i}`,
        title: search,
        subtitle: 'Recent search',
        icon: History,
        type: 'recent' as SearchResultType,
        category: 'RECENT',
        action: () => {
          setQuery(search)
        },
        keywords: [search]
      })),
      // Popular searches
      ...popularSearches.slice(0, 3).map((search, i) => ({
        id: `popular-${i}`,
        title: search.query,
        subtitle: `${search.count} searches`,
        icon: TrendingUp,
        type: 'navigation' as SearchResultType,
        category: 'TRENDING',
        action: () => {
          setQuery(search.query)
        },
        keywords: [search.query]
      }))
    ]
  }, [workspaceSlug, router, onClose, recentSearches, popularSearches])

  // Parse filter commands from natural language
  const parseFilterCommand = useCallback((query: string): ParsedFilter | null => {
    const lowerQuery = query.toLowerCase()
    const filter: ParsedFilter = {}
    let hasFilter = false

    // Status filters: "show pending", "find approved", "list rejected"
    const statusMatch = lowerQuery.match(/(?:show|find|list|get|filter)\s+(?:all\s+)?(?:the\s+)?(pending|approved|rejected|draft|submitted|review|in\s*progress|completed|active|inactive)/i)
    if (statusMatch) {
      filter.status = [statusMatch[1].replace(/\s+/g, '_')]
      hasFilter = true
    }

    // Date filters: "after January", "before 2024", "this month", "last week"
    const dateMatch = lowerQuery.match(/(?:after|before|since|until|from|in)\s+(january|february|march|april|may|june|july|august|september|october|november|december|\d{4}|this\s+(?:month|week|year)|last\s+(?:month|week|year))/i)
    if (dateMatch) {
      filter.dateRange = { start: dateMatch[1] }
      hasFilter = true
    }

    // Field-specific: "where status is", "with tag", "by author"
    const fieldMatch = lowerQuery.match(/(?:where|with|by|having)\s+(\w+)\s+(?:is|=|equals?)\s+(.+)/i)
    if (fieldMatch) {
      filter.field = fieldMatch[1]
      filter.value = fieldMatch[2].trim()
      hasFilter = true
    }

    return hasFilter ? filter : null
  }, [])

  // Get contextual actions based on current page
  const getContextualActions = useCallback((query: string, context: PageContext): AIAction[] => {
    const actions: AIAction[] = []
    const lowerQuery = query.toLowerCase()

    // Table-specific actions
    if (context === 'table') {
      if (lowerQuery.match(/add\s*(a\s+)?(new\s+)?(row|record|entry)/i)) {
        actions.push({
          id: 'ctx-add-row',
          title: '✨ Add new row to this table',
          subtitle: 'Context: You\'re viewing a table',
          icon: Plus,
          type: 'action',
          category: 'CONTEXTUAL ACTION',
          action: () => {
            // Dispatch add row event
            window.dispatchEvent(new CustomEvent('omnisearch:add-row'))
            onClose()
          },
          confidence: 0.9
        })
      }
      if (lowerQuery.match(/add\s*(a\s+)?(new\s+)?(column|field)/i)) {
        actions.push({
          id: 'ctx-add-column',
          title: '✨ Add new column to this table',
          subtitle: 'Context: You\'re viewing a table',
          icon: Plus,
          type: 'action',
          category: 'CONTEXTUAL ACTION',
          action: () => {
            window.dispatchEvent(new CustomEvent('omnisearch:add-column'))
            onClose()
          },
          confidence: 0.9
        })
      }
      if (lowerQuery.match(/export|download|csv|excel/i)) {
        actions.push({
          id: 'ctx-export',
          title: '✨ Export this table',
          subtitle: 'Download as CSV or Excel',
          icon: ExternalLink,
          type: 'action',
          category: 'CONTEXTUAL ACTION',
          action: () => {
            window.dispatchEvent(new CustomEvent('omnisearch:export-table'))
            onClose()
          },
          confidence: 0.85
        })
      }
      if (lowerQuery.match(/filter|sort|hide|show\s+column/i)) {
        actions.push({
          id: 'ctx-filter',
          title: '✨ Open table filters',
          subtitle: 'Filter, sort, or hide columns',
          icon: SlidersHorizontal,
          type: 'action',
          category: 'CONTEXTUAL ACTION',
          action: () => {
            window.dispatchEvent(new CustomEvent('omnisearch:open-filters'))
            onClose()
          },
          confidence: 0.85
        })
      }
    }

    // Form-specific actions
    if (context === 'form') {
      if (lowerQuery.match(/add\s*(a\s+)?(new\s+)?(field|question|input)/i)) {
        actions.push({
          id: 'ctx-add-field',
          title: '✨ Add field to this form',
          subtitle: 'Context: You\'re editing a form',
          icon: Plus,
          type: 'action',
          category: 'CONTEXTUAL ACTION',
          action: () => {
            window.dispatchEvent(new CustomEvent('omnisearch:add-form-field'))
            onClose()
          },
          confidence: 0.9
        })
      }
      if (lowerQuery.match(/preview|test|view\s+form/i)) {
        actions.push({
          id: 'ctx-preview-form',
          title: '✨ Preview this form',
          subtitle: 'See how it looks to users',
          icon: ExternalLink,
          type: 'action',
          category: 'CONTEXTUAL ACTION',
          action: () => {
            window.dispatchEvent(new CustomEvent('omnisearch:preview-form'))
            onClose()
          },
          confidence: 0.85
        })
      }
      if (lowerQuery.match(/publish|share|send|make\s+live/i)) {
        actions.push({
          id: 'ctx-publish-form',
          title: '✨ Publish this form',
          subtitle: 'Make it available for submissions',
          icon: CheckSquare,
          type: 'action',
          category: 'CONTEXTUAL ACTION',
          action: () => {
            window.dispatchEvent(new CustomEvent('omnisearch:publish-form'))
            onClose()
          },
          confidence: 0.85
        })
      }
    }

    // Workflow-specific actions
    if (context === 'workflow') {
      if (lowerQuery.match(/add\s*(a\s+)?(new\s+)?(stage|step)/i)) {
        actions.push({
          id: 'ctx-add-stage',
          title: '✨ Add stage to workflow',
          subtitle: 'Context: You\'re editing a workflow',
          icon: Plus,
          type: 'action',
          category: 'CONTEXTUAL ACTION',
          action: () => {
            window.dispatchEvent(new CustomEvent('omnisearch:add-workflow-stage'))
            onClose()
          },
          confidence: 0.9
        })
      }
    }

    // Hub-specific actions
    if (context === 'hub') {
      if (lowerQuery.match(/create|add\s+(new\s+)?(event|program|activity)/i)) {
        actions.push({
          id: 'ctx-add-activity',
          title: '✨ Create new activity',
          subtitle: 'Context: You\'re in a hub',
          icon: Plus,
          type: 'action',
          category: 'CONTEXTUAL ACTION',
          action: () => {
            window.dispatchEvent(new CustomEvent('omnisearch:add-activity'))
            onClose()
          },
          confidence: 0.9
        })
      }
    }

    return actions.sort((a, b) => b.confidence - a.confidence)
  }, [onClose])

  // Data-aware action detection - matches entity names
  const detectDataAwareActions = useCallback((query: string): AIAction[] => {
    const actions: AIAction[] = []
    const lowerQuery = query.toLowerCase()

    // "open table X" or "go to X table"
    const tableOpenMatch = lowerQuery.match(/(?:open|go\s*to|view|show)\s+(?:table\s+)?["']?([^"']+?)["']?\s*(?:table)?$/i)
    if (tableOpenMatch) {
      const searchName = tableOpenMatch[1].toLowerCase().trim()
      const matchedTables = cachedTables.filter(t => 
        t.name.toLowerCase().includes(searchName) || 
        searchName.includes(t.name.toLowerCase())
      )
      
      matchedTables.forEach(table => {
        actions.push({
          id: `data-open-table-${table.id}`,
          title: `✨ Open table "${table.name}"`,
          subtitle: 'Data-aware: Matched your table',
          icon: Table2,
          type: 'action',
          category: 'AI SUGGESTION',
          action: () => {
            router.push(`/workspace/${workspaceSlug}/table/${table.id}`)
            onClose()
          },
          confidence: 0.95
        })
      })
    }

    // "open form X" or "edit X form"
    const formOpenMatch = lowerQuery.match(/(?:open|go\s*to|view|edit)\s+(?:form\s+)?["']?([^"']+?)["']?\s*(?:form)?$/i)
    if (formOpenMatch) {
      const searchName = formOpenMatch[1].toLowerCase().trim()
      const matchedForms = cachedForms.filter(f => 
        f.name.toLowerCase().includes(searchName) || 
        searchName.includes(f.name.toLowerCase())
      )
      
      matchedForms.forEach(form => {
        actions.push({
          id: `data-open-form-${form.id}`,
          title: `✨ Open form "${form.name}"`,
          subtitle: 'Data-aware: Matched your form',
          icon: FileText,
          type: 'action',
          category: 'AI SUGGESTION',
          action: () => {
            router.push(`/workspace/${workspaceSlug}/form/${form.id}`)
            onClose()
          },
          confidence: 0.95
        })
      })
    }

    // "find [person name]" - search for rows containing name
    const findPersonMatch = lowerQuery.match(/(?:find|search\s*for|look\s*up|locate)\s+["']?([a-zA-Z]+\s+[a-zA-Z]+)["']?/i)
    if (findPersonMatch) {
      const personName = findPersonMatch[1]
      actions.push({
        id: 'data-find-person',
        title: `✨ Search for "${personName}"`,
        subtitle: 'Search across all tables and submissions',
        icon: Users,
        type: 'action',
        category: 'AI SUGGESTION',
        action: () => {
          setQuery(personName)
        },
        confidence: 0.8
      })
    }

    return actions
  }, [cachedTables, cachedForms, workspaceSlug, router, onClose])

  // AI-powered action detection from natural language (enhanced with multi-action)
  const detectActionsFromQuery = useCallback((query: string): AIAction[] => {
    const lowerQuery = query.toLowerCase()
    const actions: AIAction[] = []
    const pageContext = detectPageContext()
    
    // 1. Data-aware actions (highest priority - matches actual workspace data)
    actions.push(...detectDataAwareActions(query))
    
    // 2. Contextual actions (based on current page)
    actions.push(...getContextualActions(query, pageContext))

    // 3. Filter commands
    const filterParsed = parseFilterCommand(query)
    if (filterParsed) {
      const filterDesc = []
      if (filterParsed.status) filterDesc.push(`Status: ${filterParsed.status.join(', ')}`)
      if (filterParsed.dateRange) filterDesc.push(`Date: ${filterParsed.dateRange.start}`)
      if (filterParsed.field) filterDesc.push(`${filterParsed.field}: ${filterParsed.value}`)
      
      actions.push({
        id: 'ai-filter-command',
        title: '✨ Apply filter',
        subtitle: filterDesc.join(' • '),
        icon: ListFilter,
        type: 'action',
        category: 'AI SUGGESTION',
        action: () => {
          // Dispatch filter event with parsed data
          window.dispatchEvent(new CustomEvent('omnisearch:apply-filter', { 
            detail: filterParsed 
          }))
          onClose()
        },
        confidence: 0.85
      })
    }
    
    // 4. General create actions
    if (lowerQuery.match(/^(create|add|new|make)\s+(a\s+)?(table|data\s*table)/i)) {
      actions.push({
        id: 'ai-action-create-table',
        title: '✨ Create a new table',
        subtitle: 'AI detected: You want to create a table',
        icon: Zap,
        type: 'action',
        category: 'AI SUGGESTION',
        action: () => {
          router.push(`/workspace/${workspaceSlug}?action=create-table`)
          onClose()
        },
        confidence: 0.9
      })
    }
    
    if (lowerQuery.match(/^(create|add|new|make|build)\s+(a\s+)?(form|survey|application)/i)) {
      actions.push({
        id: 'ai-action-create-form',
        title: '✨ Create a new form',
        subtitle: 'AI detected: You want to create a form',
        icon: Zap,
        type: 'action',
        category: 'AI SUGGESTION',
        action: () => {
          router.push(`/workspace/${workspaceSlug}?action=create-form`)
          onClose()
        },
        confidence: 0.9
      })
    }
    
    if (lowerQuery.match(/^(create|add|new|set\s*up)\s+(a\s+)?(workflow|review|approval)/i)) {
      actions.push({
        id: 'ai-action-create-workflow',
        title: '✨ Create a review workflow',
        subtitle: 'AI detected: You want to set up a workflow',
        icon: Zap,
        type: 'action',
        category: 'AI SUGGESTION',
        action: () => {
          router.push(`/workspace/${workspaceSlug}/workflows/new`)
          onClose()
        },
        confidence: 0.9
      })
    }

    // 5. Show/View actions
    if (lowerQuery.match(/^(show|view|see|find|list|get)\s+(me\s+)?(all\s+)?(my\s+)?(tables|data)/i)) {
      actions.push({
        id: 'ai-action-show-tables',
        title: '✨ Show all tables',
        subtitle: 'AI detected: You want to see your tables',
        icon: Zap,
        type: 'action',
        category: 'AI SUGGESTION',
        action: () => {
          router.push(`/workspace/${workspaceSlug}/tables`)
          onClose()
        },
        confidence: 0.85
      })
    }
    
    if (lowerQuery.match(/^(show|view|see|find|list|get)\s+(me\s+)?(all\s+)?(my\s+)?(forms|applications|surveys)/i)) {
      actions.push({
        id: 'ai-action-show-forms',
        title: '✨ Show all forms',
        subtitle: 'AI detected: You want to see your forms',
        icon: Zap,
        type: 'action',
        category: 'AI SUGGESTION',
        action: () => {
          router.push(`/workspace/${workspaceSlug}/forms`)
          onClose()
        },
        confidence: 0.85
      })
    }
    
    if (lowerQuery.match(/^(show|view|see|find|list|get)\s+(me\s+)?(all\s+)?(my\s+)?(submissions|responses)/i)) {
      actions.push({
        id: 'ai-action-show-submissions',
        title: '✨ Show form submissions',
        subtitle: 'AI detected: You want to see submissions',
        icon: Zap,
        type: 'action',
        category: 'AI SUGGESTION',
        action: () => {
          router.push(`/workspace/${workspaceSlug}/forms`)
          onClose()
        },
        confidence: 0.85
      })
    }
    
    if (lowerQuery.match(/^(show|view|see|find|list|get)\s+(me\s+)?(all\s+)?(my\s+)?(workflows|reviews)/i)) {
      actions.push({
        id: 'ai-action-show-workflows',
        title: '✨ Show workflows',
        subtitle: 'AI detected: You want to see your workflows',
        icon: Zap,
        type: 'action',
        category: 'AI SUGGESTION',
        action: () => {
          router.push(`/workspace/${workspaceSlug}/workflows`)
          onClose()
        },
        confidence: 0.85
      })
    }
    
    if (lowerQuery.match(/^(show|view|see|find|go\s*to)\s+(me\s+)?(the\s+)?(activities|programs|events)/i)) {
      actions.push({
        id: 'ai-action-show-activities',
        title: '✨ Go to Activities Hub',
        subtitle: 'AI detected: You want to see activities',
        icon: Zap,
        type: 'action',
        category: 'AI SUGGESTION',
        action: () => {
          router.push(`/workspace/${workspaceSlug}/activities`)
          onClose()
        },
        confidence: 0.85
      })
    }
    
    if (lowerQuery.match(/^(show|view|see|find|go\s*to)\s+(me\s+)?(the\s+)?(requests|inbox)/i)) {
      actions.push({
        id: 'ai-action-show-requests',
        title: '✨ Go to Request Hub',
        subtitle: 'AI detected: You want to see requests',
        icon: Zap,
        type: 'action',
        category: 'AI SUGGESTION',
        action: () => {
          router.push(`/workspace/${workspaceSlug}/request-hub`)
          onClose()
        },
        confidence: 0.85
      })
    }

    // 6. Navigation actions
    if (lowerQuery.match(/^(go\s*to|open|navigate\s*to)\s+(the\s+)?(dashboard|home|overview)/i)) {
      actions.push({
        id: 'ai-action-go-dashboard',
        title: '✨ Go to Dashboard',
        subtitle: 'AI detected: Navigate to dashboard',
        icon: Zap,
        type: 'action',
        category: 'AI SUGGESTION',
        action: () => {
          router.push(`/workspace/${workspaceSlug}`)
          onClose()
        },
        confidence: 0.9
      })
    }
    
    if (lowerQuery.match(/^(go\s*to|open|navigate\s*to)\s+(the\s+)?settings/i)) {
      actions.push({
        id: 'ai-action-go-settings',
        title: '✨ Go to Settings',
        subtitle: 'AI detected: Navigate to settings',
        icon: Zap,
        type: 'action',
        category: 'AI SUGGESTION',
        action: () => {
          router.push(`/workspace/${workspaceSlug}/settings`)
          onClose()
        },
        confidence: 0.9
      })
    }

    // 7. Help/How-to detection
    if (lowerQuery.match(/^(how\s+(do\s+i|to|can\s+i)|help|what\s+is|explain)/i)) {
      actions.push({
        id: 'ai-help',
        title: '✨ Get help',
        subtitle: 'Open help documentation',
        icon: HelpCircle,
        type: 'action',
        category: 'AI SUGGESTION',
        action: () => {
          window.dispatchEvent(new CustomEvent('omnisearch:open-help', { 
            detail: { query: query } 
          }))
          onClose()
        },
        confidence: 0.7
      })
    }

    // Sort by confidence and dedupe
    const uniqueActions = actions.filter((action, index, self) => 
      index === self.findIndex(a => a.id === action.id)
    )
    
    return uniqueActions.sort((a, b) => b.confidence - a.confidence).slice(0, 5)
  }, [workspaceSlug, router, onClose, detectPageContext, detectDataAwareActions, getContextualActions, parseFilterCommand])

  // Legacy single-action wrapper for backward compatibility
  const detectActionFromQuery = useCallback((query: string): SearchResult | null => {
    const actions = detectActionsFromQuery(query)
    if (actions.length === 0) return null
    
    // Convert AIAction to SearchResult
    const action = actions[0]
    return {
      id: action.id,
      title: action.title,
      subtitle: action.subtitle,
      icon: action.icon,
      type: action.type,
      category: action.category,
      action: action.action
    }
  }, [detectActionsFromQuery])

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
      // Get ALL AI-detected actions (multi-action support)
      const aiActions = detectActionsFromQuery(searchQuery)
      
      // Convert AIActions to SearchResults
      const aiResults: SearchResult[] = aiActions.map(action => ({
        id: action.id,
        title: action.title,
        subtitle: action.subtitle,
        icon: action.icon,
        type: action.type,
        category: action.category,
        action: action.action,
        keywords: action.keywords
      }))
      
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

      // Combine results: AI actions first (all of them), then semantic, then filtered defaults
      const allResults = [
        ...aiResults,
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
  }, [getDefaultResults, workspaceId, onClose, detectActionsFromQuery])

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
    if (['row', 'submission', 'table'].includes(r.entityType)) {
      actions.push({
        label: 'Find Similar',
        icon: Sparkles,
        action: () => {
          handleFindSimilar(r.entityId, r.entityType, r.title)
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

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      switch (e.key) {
        case 'Escape':
          if (showSimilarResults) {
            backToSearch()
          } else {
            onClose()
          }
          break
        case 'ArrowDown':
          e.preventDefault()
          const displayResults = showSimilarResults ? similarResults : results
          setSelectedIndex(prev => 
            prev < displayResults.length - 1 ? prev + 1 : 0
          )
          break
        case 'ArrowUp':
          e.preventDefault()
          const displayResults2 = showSimilarResults ? similarResults : results
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : displayResults2.length - 1
          )
          break
        case 'Enter':
          e.preventDefault()
          const activeResults = showSimilarResults ? similarResults : results
          if (activeResults[selectedIndex]) {
            saveToRecent(query)
            activeResults[selectedIndex].action()
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, selectedIndex, results, similarResults, showSimilarResults, onClose, query])

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
      setShowSimilarResults(false)
      setSimilarResults([])
      setSuggestions([])
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

  // Determine which results to display
  const displayResults = showSimilarResults ? similarResults : results
  const displayGroupedResults = displayResults.reduce((groups, result) => {
    if (!groups[result.category]) {
      groups[result.category] = []
    }
    groups[result.category].push(result)
    return groups
  }, {} as Record<string, SearchResult[]>)

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
              {showSimilarResults ? (
                <button 
                  onClick={backToSearch}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <ArrowRight className="w-5 h-5 text-gray-400 rotate-180" />
                </button>
              ) : (
                <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
              )}
              {showSimilarResults ? (
                <div className="flex-1 text-gray-900 text-[15px]">
                  Similar to: <span className="font-medium">{similarSourceTitle}</span>
                </div>
              ) : (
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search for anything..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="flex-1 bg-transparent text-gray-900 placeholder-gray-400 outline-none text-[15px]"
                  autoFocus
                />
              )}
              {isLoading && (
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
            
            {/* Suggestions */}
            {suggestions.length > 0 && !showSimilarResults && (
              <div className="px-5 pb-3 flex flex-wrap gap-2">
                {suggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => setQuery(suggestion)}
                    className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Results */}
          <div 
            ref={listRef}
            className="max-h-[420px] overflow-y-auto overscroll-contain"
          >
            {displayResults.length === 0 && !isLoading ? (
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
                {Object.entries(displayGroupedResults).map(([category, categoryResults]) => (
                  <div key={category} className="mb-1">
                    {/* Category Header */}
                    <div className="px-4 py-2">
                      <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                        {category}
                      </div>
                    </div>

                    {/* Results */}
                    {categoryResults.map((result) => {
                      const globalIndex = displayResults.indexOf(result)
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

                          {/* Badge (similarity %, hub type, etc.) */}
                          {result.badge && (
                            <span className="px-2 py-0.5 text-[10px] font-medium text-purple-600 bg-purple-50 rounded-full">
                              {result.badge}
                            </span>
                          )}

                          {/* Shortcut */}
                          {result.shortcut && !isSelected && (
                            <kbd className="px-2 py-1 text-[11px] font-medium text-gray-400 bg-gray-50 border border-gray-200 rounded">
                              {result.shortcut}
                            </kbd>
                          )}

                          {/* Secondary Actions (Find Similar button) */}
                          {result.secondaryActions && isSelected && (
                            <div className="flex items-center gap-1">
                              {result.secondaryActions.map((action, i) => (
                                <button
                                  key={i}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    action.action()
                                  }}
                                  className="p-1.5 hover:bg-gray-200 rounded-md transition-colors"
                                  title={action.label}
                                >
                                  <action.icon className="w-4 h-4 text-purple-500" />
                                </button>
                              ))}
                            </div>
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
                  <span>{showSimilarResults ? 'Back' : 'Close'}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {showSimilarResults && (
                  <div className="flex items-center gap-1.5 text-[11px] text-purple-600">
                    <Sparkles className="w-3 h-3" />
                    <span>Vector Similarity</span>
                  </div>
                )}
                {isSemanticEnabled && !showSimilarResults && (
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
