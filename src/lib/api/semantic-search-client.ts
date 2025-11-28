/**
 * Semantic Search API Client
 * Provides AI-powered search capabilities using Cohere embeddings
 */

import { goFetch } from './go-client'
import type {
  HybridSearchRequest,
  HybridSearchResponse,
  SemanticSearchResult,
  SimilarItemsResponse,
  EmbeddingStats,
  SearchEntityType,
} from '@/types/search'

/**
 * Semantic Search Client
 * Uses Cohere embeddings for intelligent search across workspace entities
 */
export const semanticSearchClient = {
  /**
   * Perform hybrid search combining keyword + semantic search
   * Falls back to keyword-only if semantic search unavailable
   */
  async hybridSearch(
    workspaceId: string,
    query: string,
    options?: {
      hubType?: string
      entityType?: SearchEntityType
      tableId?: string
      limit?: number
      useSemantics?: boolean
    }
  ): Promise<HybridSearchResponse> {
    const request: HybridSearchRequest = {
      query,
      filters: {
        hubType: options?.hubType as any,
        entityType: options?.entityType,
        tableId: options?.tableId,
      },
      limit: options?.limit || 50,
      useSemantics: options?.useSemantics ?? true,
    }

    return goFetch<HybridSearchResponse>('/search/hybrid', {
      method: 'POST',
      body: JSON.stringify(request),
      params: { workspace_id: workspaceId },
    })
  },

  /**
   * Find similar items to a given entity using vector similarity
   */
  async findSimilar(
    entityId: string,
    entityType: SearchEntityType,
    options?: { limit?: number }
  ): Promise<SimilarItemsResponse> {
    return goFetch<SimilarItemsResponse>(
      `/search/similar/${entityId}`,
      {
        params: {
          entity_type: entityType,
          limit: String(options?.limit || 10),
        },
      }
    )
  },

  /**
   * Queue an item for embedding generation
   */
  async queueForEmbedding(
    entityId: string,
    entityType: SearchEntityType,
    priority: number = 5
  ): Promise<{ message: string }> {
    return goFetch<{ message: string }>('/search/embeddings/queue', {
      method: 'POST',
      body: JSON.stringify({
        entity_id: entityId,
        entity_type: entityType,
        priority,
      }),
    })
  },

  /**
   * Trigger embedding generation for pending items
   * Typically called by admin or background worker
   */
  async generateEmbeddings(
    batchSize: number = 50
  ): Promise<{ processed: number; message: string }> {
    return goFetch<{ processed: number; message: string }>(
      '/search/embeddings/generate',
      {
        method: 'POST',
        params: { batch_size: String(batchSize) },
      }
    )
  },

  /**
   * Get embedding coverage statistics
   */
  async getEmbeddingStats(
    workspaceId?: string
  ): Promise<{ stats: EmbeddingStats[] }> {
    const params: Record<string, string> = {}
    if (workspaceId) {
      params.workspace_id = workspaceId
    }
    return goFetch<{ stats: EmbeddingStats[] }>(
      '/search/embeddings/stats',
      { params }
    )
  },

  /**
   * Smart search (keyword + fuzzy, uses database functions)
   */
  async smartSearch(
    workspaceId: string,
    query: string,
    options?: {
      types?: string[]
      limit?: number
    }
  ): Promise<{
    results: SemanticSearchResult[]
    total: number
    query: string
    took: number
    suggestions?: string[]
    usedFuzzy?: boolean
  }> {
    const params: Record<string, string> = {
      q: query,
      workspace_id: workspaceId,
    }
    if (options?.types) {
      params.types = options.types.join(',')
    }
    if (options?.limit) {
      params.limit = String(options.limit)
    }
    return goFetch('/search/smart', { params })
  },
}

/**
 * Hook-friendly wrapper for semantic search
 * Returns results formatted for OmniSearch component
 */
export async function performSemanticSearch(
  workspaceId: string,
  query: string,
  options?: {
    hubType?: string
    entityType?: SearchEntityType
    limit?: number
  }
): Promise<{
  results: SemanticSearchResult[]
  isSemanticEnabled: boolean
  took: number
}> {
  try {
    const response = await semanticSearchClient.hybridSearch(
      workspaceId,
      query,
      options
    )
    return {
      results: response.results,
      isSemanticEnabled: response.used_semantic,
      took: response.took_ms,
    }
  } catch (error) {
    console.error('Semantic search failed:', error)
    // Return empty results on error
    return {
      results: [],
      isSemanticEnabled: false,
      took: 0,
    }
  }
}

export default semanticSearchClient
