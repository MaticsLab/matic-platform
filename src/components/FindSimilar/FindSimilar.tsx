"use client"

import React from 'react'
import { Sparkles, Loader2, Table2, FileText, ChevronRight } from 'lucide-react'
import { useFindSimilar } from '@/hooks/useSemanticSearch'
import type { SearchEntityType, SimilarItem } from '@/types/search'
import { cn } from '@/lib/utils'

interface FindSimilarButtonProps {
  entityId: string
  entityType: SearchEntityType
  onSelect?: (item: SimilarItem) => void
  className?: string
}

/**
 * Button that shows similar items when clicked
 * Uses Cohere embeddings for semantic similarity
 */
export function FindSimilarButton({ 
  entityId, 
  entityType, 
  onSelect,
  className 
}: FindSimilarButtonProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const { similarItems, isLoading, error, refresh } = useFindSimilar(
    isOpen ? entityId : null,
    isOpen ? entityType : null,
    { autoFetch: true, limit: 5 }
  )

  const handleClick = () => {
    setIsOpen(!isOpen)
    if (!isOpen) {
      refresh()
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md transition-colors",
          isOpen 
            ? "bg-purple-100 text-purple-700" 
            : "text-gray-500 hover:bg-gray-100 hover:text-gray-700",
          className
        )}
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span>Find Similar</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="p-2 border-b border-gray-100">
            <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
              <Sparkles className="w-3.5 h-3.5 text-purple-500" />
              <span>Similar Items</span>
              {isLoading && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {error && (
              <div className="p-3 text-xs text-red-600">
                {error}
              </div>
            )}

            {!isLoading && similarItems.length === 0 && !error && (
              <div className="p-4 text-center text-xs text-gray-500">
                No similar items found
              </div>
            )}

            {similarItems.map((item) => (
              <button
                key={item.entityId}
                onClick={() => {
                  onSelect?.(item)
                  setIsOpen(false)
                }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex-shrink-0">
                  {item.entityType === 'table' ? (
                    <Table2 className="w-4 h-4 text-gray-400" />
                  ) : (
                    <FileText className="w-4 h-4 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {item.title}
                  </div>
                  {item.subtitle && (
                    <div className="text-xs text-gray-500 truncate">
                      {item.subtitle}
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0 flex items-center gap-1">
                  <span className="text-xs text-purple-600 font-medium">
                    {Math.round(item.similarity * 100)}%
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface SimilarItemsPanelProps {
  entityId: string
  entityType: SearchEntityType
  onSelect?: (item: SimilarItem) => void
  limit?: number
  className?: string
}

/**
 * Panel showing similar items - for detail views
 */
export function SimilarItemsPanel({
  entityId,
  entityType,
  onSelect,
  limit = 5,
  className
}: SimilarItemsPanelProps) {
  const { similarItems, isLoading, error, refresh } = useFindSimilar(
    entityId,
    entityType,
    { autoFetch: true, limit }
  )

  if (isLoading) {
    return (
      <div className={cn("p-4", className)}>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Finding similar items...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn("p-4", className)}>
        <div className="text-sm text-red-600">{error}</div>
      </div>
    )
  }

  if (similarItems.length === 0) {
    return null
  }

  return (
    <div className={cn("border rounded-lg bg-white", className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" />
          <h3 className="text-sm font-medium text-gray-900">Similar Items</h3>
        </div>
        <button
          onClick={refresh}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          Refresh
        </button>
      </div>

      <div className="divide-y divide-gray-100">
        {similarItems.map((item) => (
          <button
            key={item.entityId}
            onClick={() => onSelect?.(item)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
          >
            <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-md flex items-center justify-center">
              {item.entityType === 'table' ? (
                <Table2 className="w-4 h-4 text-gray-500" />
              ) : (
                <FileText className="w-4 h-4 text-gray-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 truncate">
                {item.title}
              </div>
              {item.subtitle && (
                <div className="text-sm text-gray-500 truncate">
                  {item.subtitle}
                </div>
              )}
            </div>
            <div className="flex-shrink-0">
              <div className="px-2 py-1 bg-purple-50 text-purple-700 text-xs font-medium rounded">
                {Math.round(item.similarity * 100)}% match
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default FindSimilarButton
