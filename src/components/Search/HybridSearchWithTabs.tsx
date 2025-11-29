'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, FileText, Calendar, Users, Zap, Clock, Settings, MessageSquare, Folder, User, Database } from 'lucide-react'
import { HybridSearchEngine } from '@/lib/search/hybrid-search-engine'
import { TabManager } from '@/lib/tab-manager'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

interface HybridSearchProps {
  workspaceId: string
  tabManager: TabManager | null
  className?: string
}

// Helper Components
interface QuickActionItemProps {
  icon: React.ElementType
  title: string
  description: string
  shortcut?: string
  onClick: () => void
}

const QuickActionItem: React.FC<QuickActionItemProps> = ({ icon: Icon, title, description, shortcut, onClick }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 text-left"
  >
    <Icon size={16} className="text-gray-500" />
    <div className="flex-1 min-w-0">
      <div className="text-sm font-medium text-gray-900">{title}</div>
      <div className="text-xs text-gray-500">{description}</div>
    </div>
    {shortcut && (
      <kbd className="bg-gray-100 border rounded px-1.5 py-0.5 text-xs text-gray-600">
        {shortcut}
      </kbd>
    )}
  </button>
)

interface NavigationItemProps {
  icon: React.ElementType
  title: string
  description: string
  onClick: () => void
}

const NavigationItem: React.FC<NavigationItemProps> = ({ icon: Icon, title, description, onClick }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 text-left"
  >
    <Icon size={16} className="text-gray-500" />
    <div className="flex-1 min-w-0">
      <div className="text-sm font-medium text-gray-900">{title}</div>
      <div className="text-xs text-gray-500">{description}</div>
    </div>
  </button>
)

interface RecentItemProps {
  title: string
  description: string
  onClick: () => void
}

const RecentItem: React.FC<RecentItemProps> = ({ title, description, onClick }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 text-left"
  >
    <FileText size={16} className="text-gray-500" />
    <div className="flex-1 min-w-0">
      <div className="text-sm font-medium text-gray-900">{title}</div>
      <div className="text-xs text-gray-500">{description}</div>
    </div>
  </button>
)

export function HybridSearchWithTabs({ workspaceId, tabManager, className }: HybridSearchProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searchEngine, setSearchEngine] = useState<HybridSearchEngine | null>(null)
  const [indexingProgress, setIndexingProgress] = useState({ total: 0, indexed: 0, isIndexing: false })
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Initialize search engine
  useEffect(() => {
    const engine = new HybridSearchEngine(workspaceId)
    setSearchEngine(engine)

    // Monitor indexing progress
    const progressInterval = setInterval(() => {
      setIndexingProgress(engine.getIndexingProgress())
    }, 1000)

    return () => {
      clearInterval(progressInterval)
      engine.destroy()
    }
  }, [workspaceId])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
        setTimeout(() => inputRef.current?.focus(), 100)
      }
      
      if (e.key === 'Escape') {
        setIsOpen(false)
        setQuery('')
        setResults([])
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Perform search
  const performSearch = async (searchQuery: string) => {
    if (!searchEngine) return
    
    if (!searchQuery.trim()) {
      setResults([])
      return
    }

    setLoading(true)
    
    try {
      const searchResults = await searchEngine.search(searchQuery)
      setResults(searchResults)
    } catch (error) {
      console.error('Search error:', error)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query)
    }, 300)

    return () => clearTimeout(timer)
  }, [query, searchEngine])

  // Handle result selection
  const handleSelectResult = (result: any) => {
    if (tabManager) {
      tabManager.addTab({
        title: result.title,
        type: result.type as any,
        url: result.url,
        workspaceId: result.workspaceId,
        metadata: result.metadata
      })
    }
    
    setIsOpen(false)
    setQuery('')
    setResults([])
  }

  // Action handlers
  const handleQuickAction = (action: string) => {
    setIsOpen(false)
    setQuery('')
    setResults([])
    
    switch (action) {
      case 'new-form':
        if (tabManager) {
          tabManager.addTab({
            title: 'New Form',
            type: 'form',
            url: `/w/${workspaceId}/forms/new`,
            workspaceId,
          })
        }
        break
      case 'new-document':
        if (tabManager) {
          tabManager.addTab({
            title: 'New Document',
            type: 'custom',
            url: `/w/${workspaceId}/documents/new`,
            workspaceId,
          })
        }
        break
      case 'calendar':
        if (tabManager) {
          tabManager.addTab({
            title: 'Calendar',
            type: 'calendar',
            url: `/w/${workspaceId}/calendar`,
            workspaceId,
          })
        }
        break
      case 'team':
        if (tabManager) {
          tabManager.addTab({
            title: 'Team',
            type: 'custom',
            url: `/w/${workspaceId}/team`,
            workspaceId,
          })
        }
        break
    }
  }

  const handleNavigation = (route: string) => {
    setIsOpen(false)
    setQuery('')
    setResults([])
    
    if (tabManager) {
      const routes = {
        dashboard: { title: 'Dashboard', url: `/w/${workspaceId}`, type: 'custom' as const },
        forms: { title: 'Forms', url: `/w/${workspaceId}/forms`, type: 'custom' as const },
        settings: { title: 'Settings', url: `/w/${workspaceId}/settings`, type: 'custom' as const }
      }
      
      const routeInfo = routes[route as keyof typeof routes]
      if (routeInfo) {
        tabManager.addTab({
          title: routeInfo.title,
          type: routeInfo.type,
          url: routeInfo.url,
          workspaceId,
        })
      }
    }
  }

  const handleRecentItem = (itemId: string) => {
    setIsOpen(false)
    setQuery('')
    setResults([])
    
    // In a real app, you'd fetch the actual item data
    if (tabManager) {
      const items = {
        'contact-form': { title: 'Contact Form', type: 'form' as const, url: `/w/${workspaceId}/forms/contact` },
        'feedback-survey': { title: 'User Feedback Survey', type: 'form' as const, url: `/w/${workspaceId}/forms/feedback` }
      }
      
      const item = items[itemId as keyof typeof items]
      if (item) {
        tabManager.addTab({
          title: item.title,
          type: item.type,
          url: item.url,
          workspaceId,
        })
      }
    }
  }

  // Icon helpers
  const getResultIcon = (type: string) => {
    switch (type) {
      case 'form': return <FileText size={16} />
      case 'document': return <FileText size={16} />
      case 'project': return <Folder size={16} />
      case 'calendar': return <Calendar size={16} />
      case 'message': return <MessageSquare size={16} />
      case 'user': return <User size={16} />
      default: return <FileText size={16} />
    }
  }

  const getSourceIcon = (source: string) => {
    return source === 'content' ? <Zap size={12} /> : <Database size={12} />
  }

  return (
    <>
      {/* Search Trigger */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-500 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors",
          className
        )}
      >
        <Search size={16} />
        <span>Search workspace...</span>
        <div className="ml-auto flex items-center gap-1">
          <kbd className="bg-white border rounded px-1 text-xs">⌘</kbd>
          <kbd className="bg-white border rounded px-1 text-xs">K</kbd>
        </div>
      </button>

      {/* Search Modal */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-start justify-center pt-[10vh]"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsOpen(false)
              setQuery('')
              setResults([])
            }
          }}
        >
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
            {/* Search Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b">
              <Search size={20} className="text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search for anything..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 text-lg outline-none placeholder-gray-400"
                autoFocus
              />
              
              {/* Indexing Progress */}
              {indexingProgress.isIndexing && (
                <div className="text-xs text-blue-600 flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                  Indexing {indexingProgress.indexed}/{indexingProgress.total}
                </div>
              )}
            </div>

            {/* Search Content */}
            <div className="max-h-96 overflow-y-auto">
              {/* Quick Actions Section */}
              {!query.trim() && (
                <div className="p-4 border-b">
                  <h3 className="text-sm font-medium text-gray-500 mb-3">ACTIONS</h3>
                  <div className="space-y-1">
                    <QuickActionItem
                      icon={FileText}
                      title="Create New Form"
                      description="Start building a new form"
                      shortcut="⌘N"
                      onClick={() => handleQuickAction('new-form')}
                    />
                    <QuickActionItem
                      icon={FileText}
                      title="Create Document"
                      description="Start a new collaborative document"
                      onClick={() => handleQuickAction('new-document')}
                    />
                    <QuickActionItem
                      icon={Calendar}
                      title="Open Calendar"
                      description="View your schedule"
                      onClick={() => handleQuickAction('calendar')}
                    />
                    <QuickActionItem
                      icon={Users}
                      title="Team"
                      description="Manage team members"
                      onClick={() => handleQuickAction('team')}
                    />
                  </div>
                </div>
              )}

              {/* Navigation Section */}
              {!query.trim() && (
                <div className="p-4 border-b">
                  <h3 className="text-sm font-medium text-gray-500 mb-3">NAVIGATION</h3>
                  <div className="space-y-1">
                    <NavigationItem
                      icon={FileText}
                      title="Dashboard"
                      description="Go to workspace dashboard"
                      onClick={() => handleNavigation('dashboard')}
                    />
                    <NavigationItem
                      icon={FileText}
                      title="Forms"
                      description="View all forms"
                      onClick={() => handleNavigation('forms')}
                    />
                    <NavigationItem
                      icon={Settings}
                      title="Settings"
                      description="Workspace settings"
                      onClick={() => handleNavigation('settings')}
                    />
                  </div>
                </div>
              )}

              {/* Recent Items */}
              {!query.trim() && (
                <div className="p-4">
                  <h3 className="text-sm font-medium text-gray-500 mb-3">RECENT</h3>
                  <div className="space-y-1">
                    <RecentItem
                      title="Contact Form"
                      description="Last edited 2 hours ago"
                      onClick={() => handleRecentItem('contact-form')}
                    />
                    <RecentItem
                      title="User Feedback Survey"
                      description="Last edited yesterday"
                      onClick={() => handleRecentItem('feedback-survey')}
                    />
                  </div>
                </div>
              )}

              {/* Search Results */}
              {loading ? (
                <div className="px-4 py-8 text-center text-gray-500">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    Searching...
                  </div>
                </div>
              ) : query.trim() && results.length > 0 ? (
                <div className="py-2">
                  {results.map((result, index) => (
                    <button
                      key={`${result.id}-${result.source}`}
                      onClick={() => handleSelectResult(result)}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 flex flex-col gap-2"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-gray-600">
                          {getResultIcon(result.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {result.title}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span className="uppercase">{result.type}</span>
                            <span>•</span>
                            <span>{Math.round((1 - result.score) * 100)}% match</span>
                            <span>•</span>
                            <div className="flex items-center gap-1">
                              {getSourceIcon(result.source)}
                              <span>{result.source === 'content' ? 'Content' : 'Title'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Content highlights */}
                      {result.highlights && result.highlights.length > 0 && (
                        <div className="text-xs text-gray-600 pl-7 space-y-1">
                          {result.highlights.map((highlight: string, i: number) => (
                            <div key={i} className="truncate font-mono bg-gray-50 px-2 py-1 rounded">
                              {highlight}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Description for metadata matches */}
                      {result.source === 'metadata' && result.description && (
                        <div className="text-xs text-gray-600 pl-7 truncate">
                          {result.description}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              ) : query.trim() ? (
                <div className="px-4 py-8 text-center text-gray-500">
                  <div className="text-sm mb-2">No results found for &quot;{query}&quot;</div>
                  {indexingProgress.isIndexing && (
                    <div className="text-xs text-blue-600">
                      Still indexing content... Try again in a moment
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t bg-gray-50 flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-4">
                <span><kbd className="bg-white border rounded px-1">↑↓</kbd> Navigate</span>
                <span><kbd className="bg-white border rounded px-1">↵</kbd> Select</span>
                <span><kbd className="bg-white border rounded px-1">ESC</kbd> Close</span>
              </div>
              <span><kbd className="bg-white border rounded px-1">⌘</kbd> Command Palette</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}