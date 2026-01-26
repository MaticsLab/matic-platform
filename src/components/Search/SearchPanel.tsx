"use client"

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { 
  X,
  Search,
  Loader2,
  Sparkles,
  Table2,
  FileText,
  Rows3,
  Inbox,
  GitCompare,
  ArrowUp,
  ArrowDown,
  CheckCircle,
  ArrowRight,
  ChevronRight,
  Clock,
  Zap
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useClickOutside, useEventListener } from '@/lib/event-utils'
import { useSearch } from './SearchProvider'
import { performSemanticSearch } from '@/lib/api/semantic-search-client'
import { generateReport, isReportQueryLocal } from '@/lib/api/reports-client'
import type { SemanticSearchResult, AIReport, AIReportDataPoint } from '@/types/search'
import type { TabManager } from '@/lib/tab-manager'

interface SearchPanelProps {
  workspaceId?: string
  workspaceSlug?: string
  tabManager?: TabManager | null
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

// Data point card for reports
const DataPointCard: React.FC<{ dataPoint: AIReportDataPoint }> = ({ dataPoint }) => {
  const TrendIcon = dataPoint.trend === 'up' ? ArrowUp : dataPoint.trend === 'down' ? ArrowDown : null
  const trendColor = dataPoint.trend === 'up' ? 'text-green-600' : dataPoint.trend === 'down' ? 'text-red-600' : 'text-gray-500'

  return (
    <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
      <div className="text-xs text-gray-500 mb-1">{dataPoint.label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xl font-semibold text-gray-900">
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
        <div className="text-xs text-gray-400 mt-0.5">{dataPoint.subtitle}</div>
      )}
    </div>
  )
}

export function SearchPanel({ workspaceId, workspaceSlug, tabManager }: SearchPanelProps) {
  const { isPanelOpen, closePanel, query, setQuery } = useSearch()
  const [localQuery, setLocalQuery] = useState(query)
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isSemanticEnabled, setIsSemanticEnabled] = useState(false)
  const [aiReport, setAiReport] = useState<AIReport | null>(null)
  const [isReportLoading, setIsReportLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Sync query from context
  useEffect(() => {
    if (isPanelOpen) {
      setLocalQuery(query)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isPanelOpen, query])

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
    closePanel()
  }, [tabManager, workspaceId, closePanel])

  // Icon helper
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

  // Navigate to search result
  const navigateToResult = useCallback((result: SemanticSearchResult) => {
    if (!workspaceSlug) return
    
    let url = ''
    let title = result.title
    let type: 'table' | 'form' | 'custom' = 'custom'
    
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
    
    navigateTo(url, title, type)
  }, [workspaceSlug, navigateTo])

  // Perform search with report generation
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      setAiReport(null)
      setIsSemanticEnabled(false)
      return
    }

    setIsLoading(true)
    setAiReport(null)
    
    try {
      // Check if report query
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

      // Perform semantic search
      let semanticResults: SearchResult[] = []
      if (workspaceId) {
        try {
          const { results: apiResults, isSemanticEnabled: semantic } = 
            await performSemanticSearch(workspaceId, searchQuery, { limit: 15 })
          
          setIsSemanticEnabled(semantic)
          
          semanticResults = apiResults.map((r: SemanticSearchResult) => ({
            id: r.entityId,
            title: r.title,
            subtitle: r.subtitle || r.contentSnippet,
            icon: getIconForType(r.entityType),
            type: r.entityType,
            category: r.hubType ? `${r.hubType} Hub` : 'Results',
            badge: r.hubType,
            action: () => navigateToResult(r)
          }))
        } catch (error) {
          console.warn('Semantic search unavailable')
          setIsSemanticEnabled(false)
        }
      }

      setResults(semanticResults)
      setSelectedIndex(0)
      
    } catch (error) {
      console.error('Search error:', error)
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [workspaceId, navigateToResult])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(localQuery)
    }, 200)
    return () => clearTimeout(timer)
  }, [localQuery, performSearch])

  // Handle report action
  const handleReportAction = (action: string, target: string) => {
    if (action === 'navigate' && workspaceSlug) {
      const url = target.startsWith('/') ? target : `/workspace/${workspaceSlug}/${target}`
      navigateTo(url, 'View', 'custom')
    }
  }

  // Keyboard navigation
  // Keyboard navigation
  useEventListener('keydown', (e: KeyboardEvent) => {
    if (!isPanelOpen) return

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
        closePanel()
        break
    }
  })

  // Click outside to close
  useClickOutside(panelRef, closePanel, isPanelOpen)

  // Group results by category
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.category]) acc[result.category] = []
    acc[result.category].push(result)
    return acc
  }, {} as Record<string, SearchResult[]>)

  if (!isPanelOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40" />
      
      {/* Slide-over Panel */}
      <div 
        ref={panelRef}
        className="fixed top-2 right-2 bottom-2 w-full max-w-lg bg-white border border-gray-200 rounded-xl shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              placeholder="Search or ask a question..."
              className="w-full pl-10 pr-4 h-10 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:border-gray-300 focus:ring-1 focus:ring-gray-300 outline-none transition-colors"
            />
          </div>
          {isLoading && <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />}
          {isSemanticEnabled && !isLoading && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-purple-50 border border-purple-100">
              <Sparkles className="w-3.5 h-3.5 text-purple-500" />
              <span className="text-xs font-medium text-purple-600">AI</span>
            </div>
          )}
          <button
            onClick={closePanel}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* AI Report Section */}
          {(aiReport || isReportLoading) && (
            <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
              {isReportLoading ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                  <span className="text-sm text-gray-600">Analyzing your data...</span>
                </div>
              ) : aiReport && (
                <>
                  {/* AI Badge */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-purple-100 border border-purple-200">
                      <Sparkles className="w-3 h-3 text-purple-600" />
                      <span className="text-xs font-medium text-purple-700">AI Report</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {aiReport.confidence >= 0.8 ? 'High confidence' : 'Estimated'}
                    </span>
                  </div>

                  {/* Summary */}
                  <p className="text-sm text-gray-700 mb-4">{aiReport.summary}</p>

                  {/* Data Points */}
                  {aiReport.data_points && aiReport.data_points.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {aiReport.data_points.slice(0, 4).map((dp, i) => (
                        <DataPointCard key={i} dataPoint={dp} />
                      ))}
                    </div>
                  )}

                  {/* Insights */}
                  {aiReport.insights && aiReport.insights.length > 0 && (
                    <div className="space-y-2 mb-4">
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Insights</div>
                      {aiReport.insights.slice(0, 3).map((insight, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-gray-600">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span>{insight}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  {aiReport.actions && aiReport.actions.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {aiReport.actions.map((action, i) => (
                        <button
                          key={i}
                          onClick={() => handleReportAction(action.action, action.target)}
                          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 transition-colors flex items-center gap-1.5"
                        >
                          {action.label}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Search Results */}
          {Object.entries(groupedResults).length > 0 ? (
            <div className="py-2">
              {Object.entries(groupedResults).map(([category, categoryResults]) => (
                <div key={category}>
                  <div className="px-4 py-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
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
                          "w-full px-4 py-3 flex items-center gap-3 text-left transition-colors",
                          globalIndex === selectedIndex 
                            ? "bg-gray-50" 
                            : "hover:bg-gray-50"
                        )}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                          result.isAI 
                            ? "bg-gradient-to-br from-purple-100 to-blue-100" 
                            : "bg-gray-100"
                        )}>
                          <Icon className={cn(
                            "w-5 h-5",
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
                            <p className="text-sm text-gray-500 truncate">{result.subtitle}</p>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          ) : !isLoading && !aiReport && localQuery.trim() && (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <Search className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-900">No results found</p>
              <p className="text-sm text-gray-500 text-center mt-1">
                Try a different search term or ask a question
              </p>
            </div>
          )}

          {/* Empty state */}
          {!localQuery.trim() && !aiReport && (
            <div className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Try asking</span>
              </div>
              <div className="space-y-2">
                {[
                  'How many submissions do we have?',
                  'Show me recent activities',
                  'Create a new table',
                  'What forms are available?'
                ].map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => setLocalQuery(suggestion)}
                    className="w-full px-3 py-2.5 text-left text-sm text-gray-600 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors flex items-center gap-2"
                  >
                    <Zap className="w-4 h-4 text-purple-500" />
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-gray-200 text-gray-500">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-gray-200 text-gray-500">↵</kbd>
              select
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-gray-200 text-gray-500">esc</kbd>
              close
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
