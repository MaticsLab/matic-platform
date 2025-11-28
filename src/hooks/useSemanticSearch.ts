"use client"

import { useState, useCallback, useEffect } from 'react'
import { semanticSearchClient, performSemanticSearch } from '@/lib/api/semantic-search-client'
import type { 
  SemanticSearchResult, 
  SimilarItem, 
  EmbeddingStats,
  SearchEntityType 
} from '@/types/search'

interface UseSemanticSearchOptions {
  workspaceId: string
  debounceMs?: number
  limit?: number
}

interface UseSemanticSearchReturn {
  // Search state
  query: string
  setQuery: (query: string) => void
  results: SemanticSearchResult[]
  isLoading: boolean
  isSemanticEnabled: boolean
  searchTook: number
  error: string | null
  
  // Search actions
  search: (query: string) => Promise<void>
  clearResults: () => void
  
  // Similar items
  findSimilar: (entityId: string, entityType: SearchEntityType) => Promise<SimilarItem[]>
  
  // Embedding stats
  stats: EmbeddingStats[]
  loadStats: () => Promise<void>
}

/**
 * Hook for using semantic search throughout the application
 * Provides debounced search, similar items, and embedding stats
 */
export function useSemanticSearch(options: UseSemanticSearchOptions): UseSemanticSearchReturn {
  const { workspaceId, debounceMs = 300, limit = 50 } = options
  
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SemanticSearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSemanticEnabled, setIsSemanticEnabled] = useState(false)
  const [searchTook, setSearchTook] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<EmbeddingStats[]>([])

  // Perform search
  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      setIsSemanticEnabled(false)
      setSearchTook(0)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const { results, isSemanticEnabled: semantic, took } = await performSemanticSearch(
        workspaceId,
        searchQuery,
        { limit }
      )
      
      setResults(results)
      setIsSemanticEnabled(semantic)
      setSearchTook(took)
    } catch (err) {
      console.error('Semantic search error:', err)
      setError(err instanceof Error ? err.message : 'Search failed')
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [workspaceId, limit])

  // Debounced search when query changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        search(query)
      } else {
        setResults([])
      }
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [query, debounceMs, search])

  // Clear results
  const clearResults = useCallback(() => {
    setResults([])
    setQuery('')
    setError(null)
  }, [])

  // Find similar items
  const findSimilar = useCallback(async (
    entityId: string, 
    entityType: SearchEntityType
  ): Promise<SimilarItem[]> => {
    try {
      const response = await semanticSearchClient.findSimilar(entityId, entityType)
      return response.similarItems
    } catch (err) {
      console.error('Find similar error:', err)
      return []
    }
  }, [])

  // Load embedding stats
  const loadStats = useCallback(async () => {
    try {
      const response = await semanticSearchClient.getEmbeddingStats(workspaceId)
      setStats(response.stats)
    } catch (err) {
      console.error('Load stats error:', err)
    }
  }, [workspaceId])

  return {
    query,
    setQuery,
    results,
    isLoading,
    isSemanticEnabled,
    searchTook,
    error,
    search,
    clearResults,
    findSimilar,
    stats,
    loadStats,
  }
}

/**
 * Hook for finding similar items to a given entity
 */
export function useFindSimilar(
  entityId: string | null,
  entityType: SearchEntityType | null,
  options?: { limit?: number; autoFetch?: boolean }
) {
  const [similarItems, setSimilarItems] = useState<SimilarItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!entityId || !entityType) {
      setSimilarItems([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await semanticSearchClient.findSimilar(
        entityId, 
        entityType, 
        { limit: options?.limit }
      )
      setSimilarItems(response.similarItems)
    } catch (err) {
      console.error('Find similar error:', err)
      setError(err instanceof Error ? err.message : 'Failed to find similar items')
    } finally {
      setIsLoading(false)
    }
  }, [entityId, entityType, options?.limit])

  // Auto-fetch when entity changes
  useEffect(() => {
    if (options?.autoFetch !== false && entityId && entityType) {
      fetch()
    }
  }, [entityId, entityType, fetch, options?.autoFetch])

  return {
    similarItems,
    isLoading,
    error,
    refresh: fetch,
  }
}

/**
 * Hook for managing embedding queue
 */
export function useEmbeddingQueue() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [lastProcessed, setLastProcessed] = useState<number | null>(null)

  const queueItem = useCallback(async (
    entityId: string,
    entityType: SearchEntityType,
    priority?: number
  ) => {
    try {
      await semanticSearchClient.queueForEmbedding(entityId, entityType, priority)
      return true
    } catch (err) {
      console.error('Queue item error:', err)
      return false
    }
  }, [])

  const processQueue = useCallback(async (batchSize = 50) => {
    setIsProcessing(true)
    try {
      const result = await semanticSearchClient.generateEmbeddings(batchSize)
      setLastProcessed(result.processed)
      return result.processed
    } catch (err) {
      console.error('Process queue error:', err)
      return 0
    } finally {
      setIsProcessing(false)
    }
  }, [])

  return {
    queueItem,
    processQueue,
    isProcessing,
    lastProcessed,
  }
}
