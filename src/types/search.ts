/**
 * Search Types for Semantic and Hybrid Search
 */

// Entity types that can be searched
export type SearchEntityType = 
  | 'table' 
  | 'row' 
  | 'form' 
  | 'submission' 
  | 'column' 
  | 'field'
  | 'workflow'
  | 'stage'
  | 'rubric'

// Hub types for filtering
export type HubType = 
  | 'activities' 
  | 'applications'
  | 'request' 
  | 'content' 
  | 'commerce' 
  | 'data'
  | 'custom'

// Semantic field types for intelligent search
export type SemanticFieldType = 
  | 'name'
  | 'email'
  | 'phone'
  | 'address'
  | 'date'
  | 'money'
  | 'id'
  | 'description'
  | 'status'
  | 'text'
  | 'url'
  | 'score'

// Base search result from keyword search
export interface SearchResult {
  id: string
  title: string
  subtitle?: string
  description?: string
  type: SearchEntityType
  category: string
  url: string
  workspaceId: string
  metadata?: Record<string, any>
  highlights?: string[]
  score: number
  path?: string
}

// Enhanced semantic search result with vector scores
export interface SemanticSearchResult {
  entityId: string
  entityType: SearchEntityType
  tableId?: string
  title: string
  subtitle?: string
  contentSnippet?: string
  hubType?: HubType
  dataEntityType?: string
  tags?: string[]
  score: number
  keywordScore?: number
  semanticScore?: number
  metadata?: Record<string, any>
}

// Search filters
export interface SearchFilters {
  hubType?: HubType
  entityType?: SearchEntityType
  tableId?: string
  tags?: string[]
  dateFrom?: string
  dateTo?: string
  createdBy?: string
}

// Hybrid search request
export interface HybridSearchRequest {
  query: string
  filters?: SearchFilters
  limit?: number
  useSemantics?: boolean
  useFuzzy?: boolean
}

// Hybrid search response
export interface HybridSearchResponse {
  results: SemanticSearchResult[]
  total: number
  query: string
  took_ms: number
  used_semantic: boolean
  used_fuzzy: boolean
}

// Find similar items request/response
export interface SimilarItemsRequest {
  entityId: string
  entityType: SearchEntityType
  limit?: number
}

export interface SimilarItem {
  entityId: string
  entityType: SearchEntityType
  tableId?: string
  title: string
  subtitle?: string
  similarity: number
  metadata?: Record<string, any>
}

export interface SimilarItemsResponse {
  similarItems: SimilarItem[]
  source: {
    entityId: string
    entityType: SearchEntityType
  }
}

// Embedding queue item
export interface EmbeddingQueueItem {
  entityId: string
  entityType: SearchEntityType
  priority?: number
}

// Embedding stats
export interface EmbeddingStats {
  workspaceId: string
  entityType: SearchEntityType
  totalEntities: number
  embeddedCount: number
  pendingCount: number
  coveragePercent: number
}

// Search suggestions
export interface SearchSuggestion {
  text: string
  type: 'recent' | 'popular' | 'autocomplete'
  score?: number
}

// Smart search response (enhanced)
export interface SmartSearchResponse {
  results: SearchResult[]
  total: number
  query: string
  took: number
  suggestions?: string[]
  usedFuzzy?: boolean
}

// AI Report Types
export interface AIReportDataPoint {
  label: string
  value: number | string
  change?: number
  trend?: 'up' | 'down' | 'stable'
  subtitle?: string
}

export interface AIReportAction {
  label: string
  action: 'navigate' | 'export' | 'filter' | 'chart'
  target: string
  icon?: string
}

export interface AIReport {
  summary: string
  insights: string[]
  data_points: AIReportDataPoint[]
  suggestions: string[]
  query_type: 'count' | 'trend' | 'breakdown' | 'comparison' | 'list' | 'summary' | 'general'
  confidence: number
  actions: AIReportAction[]
}

export interface WorkspaceStats {
  tables: number
  forms: number
  rows: number
  submissions: number
  activities_hubs: number
  workflows: number
  pending_reviews: number
}

export interface AIReportResponse {
  report: AIReport
  stats: WorkspaceStats
  ai_enabled: boolean
  generated: string
  error?: string
}

export interface ReportQueryCheck {
  is_report: boolean
  query_type: string
}
