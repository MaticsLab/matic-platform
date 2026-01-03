import { searchClient, SearchResult as APISearchResult } from '../api/search-client'

export interface EnhancedSearchResult {
  id: string
  title: string
  subtitle?: string
  description?: string
  icon: string // Icon name
  type: string
  category: string
  url: string
  action?: () => void
  secondaryActions?: {
    label: string
    icon: string
    action: () => void
  }[]
  shortcut?: string
  keywords?: string[]
  badge?: string
  timestamp?: string
  path?: string
  score: number
  metadata?: Record<string, any>
}

/**
 * Search service that integrates with the backend API
 * and provides unified search across all workspace entities
 */
export class WorkspaceSearchService {
  private workspaceId: string
  private workspaceSlug: string
  private router: any

  constructor(workspaceId: string, workspaceSlug: string, router: any) {
    this.workspaceId = workspaceId
    this.workspaceSlug = workspaceSlug
    this.router = router
  }

  /**
   * Convert API search results to UI-friendly format
   */
  private convertToUIResults(apiResults: APISearchResult[]): EnhancedSearchResult[] {
    return apiResults.map(result => {
      const uiResult: EnhancedSearchResult = {
        id: result.id,
        title: result.title,
        subtitle: result.subtitle,
        description: result.description,
        icon: this.getIconForType(result.type),
        type: result.type,
        category: this.getCategoryForType(result.type),
        url: result.url,
        score: result.score,
        metadata: result.metadata,
        path: result.path,
      }

      // Add action based on type
      switch (result.type) {
        case 'table':
          uiResult.action = () => {
            this.router.push(`/workspace/${this.workspaceSlug}/table/${result.id}`)
          }
          uiResult.secondaryActions = [
            {
              label: 'Open in new tab',
              icon: 'external-link',
              action: () => window.open(`/workspace/${this.workspaceSlug}/table/${result.id}`, '_blank')
            },
            {
              label: 'View settings',
              icon: 'settings',
              action: () => this.router.push(`/workspace/${this.workspaceSlug}/table/${result.id}/settings`)
            }
          ]
          uiResult.badge = result.metadata?.columnCount 
            ? `${result.metadata.columnCount} columns` 
            : undefined
          break

        case 'form':
          uiResult.action = () => {
            this.router.push(`/workspace/${this.workspaceSlug}/form/${result.id}`)
          }
          uiResult.secondaryActions = [
            {
              label: 'Edit form',
              icon: 'edit',
              action: () => this.router.push(`/workspace/${this.workspaceSlug}/form/${result.id}/edit`)
            },
            {
              label: 'View submissions',
              icon: 'inbox',
              action: () => this.router.push(`/workspace/${this.workspaceSlug}/form/${result.id}/submissions`)
            }
          ]
          uiResult.badge = result.metadata?.submissionCount 
            ? `${result.metadata.submissionCount} submissions` 
            : undefined
          break


        case 'row':
          uiResult.action = () => {
            this.router.push(`${result.url}`)
          }
          uiResult.secondaryActions = [
            {
              label: 'Edit row',
              icon: 'edit',
              action: () => this.router.push(`${result.url}?action=edit`)
            },
            {
              label: 'Duplicate',
              icon: 'copy',
              action: () => this.router.push(`${result.url}?action=duplicate`)
            }
          ]
          break

        case 'submission':
          uiResult.action = () => {
            this.router.push(`${result.url}`)
          }
          break
      }

      // Add timestamp if available
      if (result.metadata?.lastUpdated) {
        uiResult.timestamp = this.formatTimestamp(result.metadata.lastUpdated)
      } else if (result.metadata?.createdAt) {
        uiResult.timestamp = this.formatTimestamp(result.metadata.createdAt)
      }

      return uiResult
    })
  }

  /**
   * Get icon name for entity type
   */
  private getIconForType(type: string): string {
    const iconMap: Record<string, string> = {
      'table': 'table-2',
      'form': 'file-text',
      'row': 'list',
      'submission': 'check-square',
      'column': 'columns',
      'field': 'input',
    }
    return iconMap[type] || 'file'
  }

  /**
   * Get category name for entity type
   */
  private getCategoryForType(type: string): string {
    const categoryMap: Record<string, string> = {
      'table': 'Tables',
      'form': 'Forms',
      'row': 'Table Rows',
      'submission': 'Form Submissions',
      'column': 'Table Columns',
      'field': 'Form Fields',
    }
    return categoryMap[type] || 'Other'
  }

  /**
   * Format timestamp to relative time
   */
  private formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    if (days < 30) return `${Math.floor(days / 7)}w ago`
    
    return date.toLocaleDateString()
  }

  /**
   * Perform search with API integration
   */
  async search(query: string): Promise<EnhancedSearchResult[]> {
    if (!query.trim()) {
      return []
    }

    try {
      const response = await searchClient.search(query, this.workspaceId)
      return this.convertToUIResults(response.results)
    } catch (error) {
      console.error('Search error:', error)
      return []
    }
  }

  /**
   * Search within a specific table
   */
  async searchTable(tableId: string, query: string): Promise<EnhancedSearchResult[]> {
    try {
      const response = await searchClient.searchTableRows(tableId, query)
      return this.convertToUIResults(response.results)
    } catch (error) {
      console.error('Table search error:', error)
      return []
    }
  }

  /**
   * Search form submissions
   */
  async searchFormSubmissions(formId: string, query: string): Promise<EnhancedSearchResult[]> {
    try {
      const response = await searchClient.searchFormSubmissions(formId, query)
      return this.convertToUIResults(response.results)
    } catch (error) {
      console.error('Form search error:', error)
      return []
    }
  }

  /**
   * Get search suggestions
   */
  async getSuggestions(query: string): Promise<string[]> {
    try {
      return await searchClient.getSuggestions(query, this.workspaceId)
    } catch (error) {
      console.error('Suggestions error:', error)
      return []
    }
  }

  /**
   * Get recent searches
   */
  async getRecentSearches(): Promise<string[]> {
    try {
      return await searchClient.getRecentSearches(this.workspaceId)
    } catch (error) {
      console.error('Recent searches error:', error)
      return []
    }
  }

  /**
   * Save search to history
   */
  async saveSearch(query: string): Promise<void> {
    try {
      await searchClient.saveSearch(this.workspaceId, query)
    } catch (error) {
      console.error('Save search error:', error)
    }
  }
}
