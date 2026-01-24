"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Search, 
  Command,
  ArrowRight,
  Clock,
  X,
  Table2,
  Inbox,
  Settings,
  Plus,
  Zap,
  Layout,
  FileText,
  Rows3,
  GitCompare,
  BarChart3,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Loader2,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  CornerDownLeft
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { performSemanticSearch } from '@/lib/api/semantic-search-client'
import { generateReport, isReportQueryLocal } from '@/lib/api/reports-client'
import type { SemanticSearchResult, AIReport, AIReportDataPoint } from '@/types/search'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  workspaceId?: string
  workspaceSlug?: string
}

type ResultType = 
  | 'table' 
  | 'form' 
  | 'row' 
  | 'submission' 
  | 'action' 
  | 'navigation' 
  | 'ai-report'
  | 'ai-action'

interface PaletteResult {
  id: string
  title: string
  subtitle?: string
  icon: React.ComponentType<any>
  type: ResultType
  category: string
  action: () => void
  shortcut?: string
  badge?: string
  isAI?: boolean
}

// AI Report inline result component
const AIReportCard: React.FC<{
  report: AIReport | null
  isLoading: boolean
  onAction: (action: string, target: string) => void
}> = ({ report, isLoading, onAction }) => {
  if (isLoading) {
    return (
      <div className="px-4 py-6 flex flex-col items-center justify-center gap-3 bg-gradient-to-r from-purple-500/5 to-blue-500/5 border-b border-zinc-800/50">
        <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
        <span className="text-sm text-zinc-400">Analyzing your data...</span>
      </div>
    )
  }

  if (!report) return null

  return (
    <div className="px-4 py-4 bg-gradient-to-r from-purple-500/5 to-blue-500/5 border-b border-zinc-800/50">
      {/* AI Badge */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20">
          <Sparkles className="w-3 h-3 text-purple-400" />
          <span className="text-xs font-medium text-purple-300">AI Report</span>
        </div>
        <span className="text-xs text-zinc-500">
          {report.confidence >= 0.8 ? 'High confidence' : 'Estimated'}
        </span>
      </div>

      {/* Summary */}
      <p className="text-sm text-zinc-200 mb-4">{report.summary}</p>

      {/* Data Points */}
      {report.data_points && report.data_points.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {report.data_points.slice(0, 4).map((dp, i) => (
            <DataPointCard key={i} dataPoint={dp} />
          ))}
        </div>
      )}

      {/* Insights */}
      {report.insights && report.insights.length > 0 && (
        <div className="space-y-1.5 mb-4">
          {report.insights.slice(0, 3).map((insight, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-zinc-400">
              <CheckCircle className="w-3.5 h-3.5 text-green-400 mt-0.5 flex-shrink-0" />
              <span>{insight}</span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {report.actions && report.actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {report.actions.map((action, i) => (
            <button
              key={i}
              onClick={() => onAction(action.action, action.target)}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors flex items-center gap-1.5"
            >
              {action.label}
              <ArrowRight className="w-3 h-3" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const DataPointCard: React.FC<{ dataPoint: AIReportDataPoint }> = ({ dataPoint }) => {
  const TrendIcon = dataPoint.trend === 'up' ? ArrowUp : dataPoint.trend === 'down' ? ArrowDown : null
  const trendColor = dataPoint.trend === 'up' ? 'text-green-400' : dataPoint.trend === 'down' ? 'text-red-400' : 'text-zinc-500'

  return (
    <div className="p-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
      <div className="text-xs text-zinc-500 mb-1">{dataPoint.label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-lg font-semibold text-zinc-100">
          {typeof dataPoint.value === 'number' ? dataPoint.value.toLocaleString() : dataPoint.value}
        </span>
        {TrendIcon && (
          <span className={cn("flex items-center text-xs", trendColor)}>
            <TrendIcon className="w-3 h-3" />
            {dataPoint.change && <span>{Math.abs(dataPoint.change)}%</span>}
          </span>
        )}
      </div>
      {dataPoint.subtitle && (
        <div className="text-xs text-zinc-500 mt-0.5">{dataPoint.subtitle}</div>
      )}
    </div>
  )
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ 
  isOpen, 
  onClose, 
  workspaceId,
  workspaceSlug 
}) => {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<PaletteResult[]>([])
  const [aiReport, setAiReport] = useState<AIReport | null>(null)
  const [isReportLoading, setIsReportLoading] = useState(false)
  const [isSemanticEnabled, setIsSemanticEnabled] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Default results
  const getDefaultResults = useCallback((): PaletteResult[] => {
    if (!workspaceSlug) return []

    return [
      {
        id: 'create-table',
        title: 'Create new table',
        subtitle: 'Add a data table to your workspace',
        icon: Table2,
        type: 'action',
        category: 'Quick Actions',
        shortcut: '⌘T',
        action: () => {
          router.push(`/workspace/${workspaceSlug}?action=create-table`)
          onClose()
        }
      },
      {
        id: 'create-form',
        title: 'Create new form',
        subtitle: 'Build a form to collect data',
        icon: FileText,
        type: 'action',
        category: 'Quick Actions',
        shortcut: '⌘F',
        action: () => {
          router.push(`/workspace/${workspaceSlug}?action=create-form`)
          onClose()
        }
      },
      {
        id: 'create-workflow',
        title: 'Create workflow',
        subtitle: 'Set up a review workflow',
        icon: GitCompare,
        type: 'action',
        category: 'Quick Actions',
        action: () => {
          router.push(`/workspace/${workspaceSlug}/workflows/new`)
          onClose()
        }
      },
      {
        id: 'nav-tables',
        title: 'Tables',
        icon: Table2,
        type: 'navigation',
        category: 'Navigate',
        action: () => {
          router.push(`/workspace/${workspaceSlug}/tables`)
          onClose()
        }
      },
      {
        id: 'nav-forms',
        title: 'Forms',
        icon: FileText,
        type: 'navigation',
        category: 'Navigate',
        action: () => {
          router.push(`/workspace/${workspaceSlug}/forms`)
          onClose()
        }
      },
      {
        id: 'nav-activities',
        title: 'Activities Hub',
        icon: Layout,
        type: 'navigation',
        category: 'Navigate',
        action: () => {
          router.push(`/workspace/${workspaceSlug}/activities`)
          onClose()
        }
      },
      {
        id: 'nav-settings',
        title: 'Settings',
        icon: Settings,
        type: 'navigation',
        category: 'Navigate',
        action: () => {
          router.push(`/workspace/${workspaceSlug}/settings`)
          onClose()
        }
      }
    ]
  }, [workspaceSlug, router, onClose])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery('')
      setResults(getDefaultResults())
      setAiReport(null)
      setSelectedIndex(0)
    }
  }, [isOpen, getDefaultResults])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

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
          onClose()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, results, selectedIndex, onClose])

  // Auto-scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`)
      selectedElement?.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  // Detect AI action from query
  const detectAIAction = useCallback((q: string): PaletteResult | null => {
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
        action: () => {
          router.push(`/workspace/${workspaceSlug}?action=create-table`)
          onClose()
        }
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
        action: () => {
          router.push(`/workspace/${workspaceSlug}?action=create-form`)
          onClose()
        }
      }
    }

    if (/^(create|set\s*up|new)\s+(a\s+)?(workflow|review)/i.test(lowerQuery)) {
      return {
        id: 'ai-create-workflow',
        title: 'Create a workflow',
        subtitle: 'I\'ll help you set up a review process',
        icon: Zap,
        type: 'ai-action',
        category: 'AI Suggestion',
        isAI: true,
        action: () => {
          router.push(`/workspace/${workspaceSlug}/workflows/new`)
          onClose()
        }
      }
    }

    if (/^(go\s*to|open|show)\s+(the\s+)?(tables?|data)/i.test(lowerQuery)) {
      return {
        id: 'ai-nav-tables',
        title: 'Go to Tables',
        icon: Zap,
        type: 'ai-action',
        category: 'AI Suggestion',
        isAI: true,
        action: () => {
          router.push(`/workspace/${workspaceSlug}/tables`)
          onClose()
        }
      }
    }

    if (/^(go\s*to|open|show)\s+(the\s+)?(forms?)/i.test(lowerQuery)) {
      return {
        id: 'ai-nav-forms',
        title: 'Go to Forms',
        icon: Zap,
        type: 'ai-action',
        category: 'AI Suggestion',
        isAI: true,
        action: () => {
          router.push(`/workspace/${workspaceSlug}/forms`)
          onClose()
        }
      }
    }

    return null
  }, [workspaceSlug, router, onClose])

  // Helper functions
  const getIconForType = (entityType: string): React.ComponentType<any> => {
    switch (entityType) {
      case 'table': return Table2
      case 'form': return FileText
      case 'row': return Rows3
      case 'submission': return Inbox
      case 'workflow': return GitCompare
      default: return Table2
    }
  }

  const getCategoryForType = (entityType: string, hubType?: string): string => {
    if (hubType) {
      return hubType.charAt(0).toUpperCase() + hubType.slice(1) + ' Hub'
    }
    switch (entityType) {
      case 'table': return 'Tables'
      case 'form': return 'Forms'
      case 'row': return 'Records'
      case 'submission': return 'Submissions'
      default: return 'Results'
    }
  }

  const navigateToResult = useCallback((result: SemanticSearchResult) => {
    if (!workspaceSlug) return
    
    switch (result.entityType) {
      case 'table':
        router.push(`/workspace/${workspaceSlug}/table/${result.entityId}`)
        break
      case 'form':
        router.push(`/workspace/${workspaceSlug}/forms/${result.entityId}`)
        break
      case 'row':
        if (result.tableId) {
          router.push(`/workspace/${workspaceSlug}/table/${result.tableId}?row=${result.entityId}`)
        }
        break
      case 'submission':
        router.push(`/workspace/${workspaceSlug}/forms/${result.tableId}/submissions/${result.entityId}`)
        break
      default:
        router.push(`/workspace/${workspaceSlug}`)
    }
  }, [workspaceSlug, router])

  // Search function
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults(getDefaultResults())
      setAiReport(null)
      setIsSemanticEnabled(false)
      return
    }

    setIsLoading(true)
    setAiReport(null)
    
    try {
      // Check if this is a report query
      const isReport = isReportQueryLocal(searchQuery)
      
      if (isReport && workspaceId) {
        setIsReportLoading(true)
        try {
          const response = await generateReport(workspaceId, searchQuery)
          setAiReport(response.report)
        } catch (error) {
          console.warn('Report generation failed:', error)
        } finally {
          setIsReportLoading(false)
        }
      }

      // Check for AI action
      const aiAction = detectAIAction(searchQuery)
      
      // Filter default results
      const defaultResults = getDefaultResults()
      const filteredDefaults = defaultResults.filter(result => {
        const searchableText = [result.title, result.subtitle || ''].join(' ').toLowerCase()
        return searchQuery.toLowerCase().split(' ').some(term => searchableText.includes(term))
      })

      // Perform semantic search
      let semanticResults: PaletteResult[] = []
      if (workspaceId) {
        try {
          const { results: apiResults, isSemanticEnabled: semantic } = 
            await performSemanticSearch(workspaceId, searchQuery, { limit: 10 })
          
          setIsSemanticEnabled(semantic)
          
          semanticResults = apiResults.map((r: SemanticSearchResult) => ({
            id: r.entityId,
            title: r.title,
            subtitle: r.subtitle || r.contentSnippet,
            icon: getIconForType(r.entityType),
            type: r.entityType as ResultType,
            category: getCategoryForType(r.entityType, r.hubType),
            badge: r.hubType,
            action: () => {
              navigateToResult(r)
              onClose()
            }
          }))
        } catch (error) {
          console.warn('Semantic search unavailable')
          setIsSemanticEnabled(false)
        }
      }

      // Combine results
      const allResults = [
        ...(aiAction ? [aiAction] : []),
        ...semanticResults,
        ...filteredDefaults
      ]
      setResults(allResults)
      setSelectedIndex(0)
      
    } catch (error) {
      console.error('Search error:', error)
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [getDefaultResults, workspaceId, detectAIAction, navigateToResult, onClose])

  const handleReportAction = (action: string, target: string) => {
    if (action === 'navigate' && workspaceSlug) {
      router.push(target.startsWith('/') ? target : `/workspace/${workspaceSlug}/${target}`)
      onClose()
    }
  }

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query)
    }, 150)
    return () => clearTimeout(timer)
  }, [query, performSearch])

  // Group results by category
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.category]) acc[result.category] = []
    acc[result.category].push(result)
    return acc
  }, {} as Record<string, PaletteResult[]>)

  if (!isOpen) return null

  return (
    <>
      {/* Subtle backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      
      {/* Command Palette */}
      <div className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-2xl z-50 px-4">
        <div className="bg-zinc-900 rounded-xl border border-zinc-700/50 shadow-2xl overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
            <Search className="w-5 h-5 text-zinc-500" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search or ask anything..."
              className="flex-1 bg-transparent text-zinc-100 text-base placeholder-zinc-500 outline-none"
            />
            {isLoading && <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />}
            {isSemanticEnabled && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">
                <Sparkles className="w-3 h-3 text-purple-400" />
                <span className="text-xs text-purple-300">AI</span>
              </div>
            )}
            <div className="flex items-center gap-1 text-xs text-zinc-500">
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">esc</kbd>
            </div>
          </div>

          {/* AI Report Section */}
          {(aiReport || isReportLoading) && (
            <AIReportCard 
              report={aiReport} 
              isLoading={isReportLoading}
              onAction={handleReportAction}
            />
          )}

          {/* Results List */}
          <div 
            ref={listRef}
            className="max-h-[50vh] overflow-y-auto py-2"
          >
            {Object.entries(groupedResults).map(([category, categoryResults]) => (
              <div key={category}>
                <div className="px-4 py-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  {category}
                </div>
                {categoryResults.map((result) => {
                  const globalIndex = results.indexOf(result)
                  const Icon = result.icon
                  
                  return (
                    <button
                      key={result.id}
                      data-index={globalIndex}
                      onClick={() => result.action()}
                      className={cn(
                        "w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors",
                        globalIndex === selectedIndex 
                          ? "bg-zinc-800/80" 
                          : "hover:bg-zinc-800/50"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        result.isAI 
                          ? "bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/20" 
                          : "bg-zinc-800 border border-zinc-700/50"
                      )}>
                        <Icon className={cn(
                          "w-4 h-4",
                          result.isAI ? "text-purple-400" : "text-zinc-400"
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-zinc-100 truncate">
                            {result.title}
                          </span>
                          {result.badge && (
                            <span className="px-1.5 py-0.5 text-xs rounded bg-zinc-700 text-zinc-400">
                              {result.badge}
                            </span>
                          )}
                        </div>
                        {result.subtitle && (
                          <p className="text-xs text-zinc-500 truncate">{result.subtitle}</p>
                        )}
                      </div>
                      {result.shortcut && (
                        <kbd className="px-1.5 py-0.5 text-xs rounded bg-zinc-800 text-zinc-500">
                          {result.shortcut}
                        </kbd>
                      )}
                      {globalIndex === selectedIndex && (
                        <CornerDownLeft className="w-4 h-4 text-zinc-500" />
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
            
            {results.length === 0 && !isLoading && !aiReport && (
              <div className="px-4 py-8 text-center">
                <AlertCircle className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-sm text-zinc-500">No results found</p>
                <p className="text-xs text-zinc-600 mt-1">Try a different search term</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-800 text-xs text-zinc-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-400">↑↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-400">↵</kbd>
                select
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Command className="w-3 h-3" />
              <span>K</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
