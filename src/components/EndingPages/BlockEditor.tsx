/**
 * Block Editor Component - Edits individual blocks
 */

'use client'

import React, { useState } from 'react'
import { EndingBlock } from '@/types/ending-blocks'
import { getBlockDefinition } from '@/lib/ending-block-registry'
import { PropertyInput } from './PropertyInput'
import { Button } from '@/ui-components/button'
import { Trash2, ChevronUp, ChevronDown, Eye, EyeOff, Lock, Unlock } from 'lucide-react'
import { BlockRenderer } from './BlockRenderer'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui-components/tabs'

interface BlockEditorProps {
  block: EndingBlock
  onUpdate: (block: EndingBlock) => void
  onDelete: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  canMoveUp?: boolean
  canMoveDown?: boolean
  isPreviewMode?: boolean
}

export function BlockEditor({
  block,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  isPreviewMode
}: BlockEditorProps) {
  const blockDef = getBlockDefinition(block.blockType)
  const [showAdvanced, setShowAdvanced] = useState(false)

  if (!blockDef) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700 font-medium">Unknown block type: {block.blockType}</p>
      </div>
    )
  }

  const handlePropChange = (propKey: string, value: any) => {
    onUpdate({
      ...block,
      props: { ...block.props, [propKey]: value }
    })
  }

  const handleToggleHidden = () => {
    onUpdate({
      ...block,
      metadata: { ...block.metadata, hidden: !block.metadata.hidden }
    })
  }

  const handleToggleLocked = () => {
    onUpdate({
      ...block,
      metadata: { ...block.metadata, locked: !block.metadata.locked }
    })
  }

  return (
    <div className={`p-4 bg-white border border-gray-200 rounded-lg ${block.metadata.hidden ? 'opacity-50' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <h3 className="font-semibold text-sm">{blockDef.label}</h3>
            <p className="text-xs text-gray-500">{blockDef.description}</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-1">
          <button
            onClick={handleToggleHidden}
            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors"
            title={block.metadata.hidden ? 'Show' : 'Hide'}
          >
            {block.metadata.hidden ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>

          {!isPreviewMode && (
            <>
              <button
                onClick={onMoveUp}
                disabled={!canMoveUp}
                className="p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
                title="Move up"
              >
                <ChevronUp className="w-4 h-4" />
              </button>

              <button
                onClick={onMoveDown}
                disabled={!canMoveDown}
                className="p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
                title="Move down"
              >
                <ChevronDown className="w-4 h-4" />
              </button>

              <button
                onClick={handleToggleLocked}
                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors"
                title={block.metadata.locked ? 'Unlock' : 'Lock'}
              >
                {block.metadata.locked ? (
                  <Lock className="w-4 h-4" />
                ) : (
                  <Unlock className="w-4 h-4" />
                )}
              </button>

              <button
                onClick={onDelete}
                className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs for properties and preview */}
      <Tabs defaultValue="properties" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="properties">Properties</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        {/* Properties Tab */}
        <TabsContent value="properties" className="space-y-4 mt-4">
          {blockDef?.schema?.properties ? Object.entries(blockDef.schema.properties).map(([propKey, propSchema]: any) => (
            <PropertyInput
              key={propKey}
              propertyKey={propKey}
              schema={propSchema}
              value={block.props[propKey]}
              onChange={(value) => handlePropChange(propKey, value)}
            />
          )) : null}

          {/* Advanced Options */}
          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm text-gray-600 hover:text-gray-900 font-medium"
            >
              {showAdvanced ? '▼' : '▶'} Advanced Options
            </button>

            {showAdvanced && (
              <div className="space-y-4 mt-4 pt-4 border-t border-gray-100">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Spacing</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-600">Margin Top</label>
                      <input
                        type="number"
                        value={block.styles?.marginTop || 0}
                        onChange={(e) =>
                          onUpdate({
                            ...block,
                            styles: { ...block.styles, marginTop: Number(e.target.value) }
                          })
                        }
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Margin Bottom</label>
                      <input
                        type="number"
                        value={block.styles?.marginBottom || 0}
                        onChange={(e) =>
                          onUpdate({
                            ...block,
                            styles: { ...block.styles, marginBottom: Number(e.target.value) }
                          })
                        }
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Custom CSS Class</label>
                  <input
                    type="text"
                    value={block.styles?.customClass || ''}
                    onChange={(e) =>
                      onUpdate({
                        ...block,
                        styles: { ...block.styles, customClass: e.target.value }
                      })
                    }
                    placeholder="e.g., text-blue-500"
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview" className="mt-4">
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <BlockRenderer block={block} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
