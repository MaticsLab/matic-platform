/**
 * Notion-Style Cover Editor - Inline text editing with slash commands
 */

'use client'

import React, { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { Plus, Type, Image as ImageIcon, AlertCircle, Minus, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BlockRenderer } from '@/components/EndingPages/BlockRenderer'
import type { EndingBlock } from '@/types/ending-blocks'
import { Button } from '@/ui-components/button'

interface NotionStyleCoverEditorProps {
  blocks: EndingBlock[]
  onUpdate: (blocks: EndingBlock[]) => void
  selectedBlockId: string | null
  onSelectBlock: (id: string | null) => void
}

export function NotionStyleCoverEditor({
  blocks,
  onUpdate,
  selectedBlockId,
  onSelectBlock,
}: NotionStyleCoverEditorProps) {
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null)
  const [showBlockMenu, setShowBlockMenu] = useState(false)
  const [blockMenuPosition, setBlockMenuPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const [insertAfterBlockId, setInsertAfterBlockId] = useState<string | null>(null)

  const handleAddBlock = (type: string) => {
    const newBlock: EndingBlock = {
      id: `block-${Date.now()}`,
      blockType: type,
      props: getDefaultProps(type),
      metadata: {
        order: blocks.length,
        hidden: false
      }
    }

    if (insertAfterBlockId) {
      const index = blocks.findIndex(b => b.id === insertAfterBlockId)
      const newBlocks = [...blocks]
      newBlocks.splice(index + 1, 0, newBlock)
      onUpdate(newBlocks)
    } else {
      onUpdate([...blocks, newBlock])
    }
    
    setShowBlockMenu(false)
    onSelectBlock(newBlock.id)
  }

  const handleDeleteBlock = (blockId: string) => {
    onUpdate(blocks.filter(b => b.id !== blockId))
    onSelectBlock(null)
  }

  const handleUpdateBlock = (blockId: string, updates: Partial<EndingBlock>) => {
    onUpdate(blocks.map(b => b.id === blockId ? { ...b, ...updates } : b))
  }

  const handleShowBlockMenu = (blockId: string | null, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setBlockMenuPosition({ top: rect.bottom + 4, left: rect.left })
    setInsertAfterBlockId(blockId)
    setShowBlockMenu(true)
  }

  return (
    <div className="w-full h-full bg-white">
      {/* Notion-style full-width container */}
      <div className="max-w-[900px] mx-auto">
        <div className="pl-12 pr-8 pt-24 pb-24">
          {/* Cover image area */}
          <div className="mb-8 group relative">
            {blocks.find(b => b.blockType === 'image' && b.metadata.order === 0) ? (
              <div
                className="relative"
                onMouseEnter={() => setHoveredBlockId(blocks[0]?.id)}
                onMouseLeave={() => setHoveredBlockId(null)}
                onClick={() => onSelectBlock(blocks[0]?.id)}
              >
                <BlockRenderer block={blocks[0]} />
                {hoveredBlockId === blocks[0]?.id && (
                  <div className="absolute top-2 right-2 flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 bg-white/90 backdrop-blur-sm hover:bg-white"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteBlock(blocks[0].id)
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={(e) => handleShowBlockMenu(null, e)}
                className="w-full py-24 border-2 border-dashed border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors text-gray-400 hover:text-gray-600"
              >
                <div className="flex flex-col items-center gap-2">
                  <ImageIcon className="w-8 h-8" />
                  <span className="text-sm font-medium">Add cover image</span>
                </div>
              </button>
            )}
          </div>

          {/* Content blocks */}
          <div className="space-y-1">
            {blocks.filter(b => !(b.blockType === 'image' && b.metadata.order === 0)).map((block, index) => (
              <div
                key={block.id}
                className={cn(
                  "group relative rounded-lg transition-all",
                  selectedBlockId === block.id && "ring-2 ring-blue-500 ring-offset-2"
                )}
                onMouseEnter={() => setHoveredBlockId(block.id)}
                onMouseLeave={() => setHoveredBlockId(null)}
                onClick={() => onSelectBlock(block.id)}
              >
                {/* Inline add button (appears on hover) */}
                {hoveredBlockId === block.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleShowBlockMenu(block.id, e)
                    }}
                    className="absolute -left-10 top-1 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-gray-100 rounded"
                    title="Add block below"
                  >
                    <Plus className="w-4 h-4 text-gray-400" />
                  </button>
                )}

                <BlockRenderer block={block} />
              </div>
            ))}
          </div>

          {/* Add first block or block at end */}
          {blocks.filter(b => !(b.blockType === 'image' && b.metadata.order === 0)).length === 0 && (
            <button
              onClick={(e) => handleShowBlockMenu(null, e)}
              className="w-full py-12 text-gray-400 hover:text-gray-600 text-left text-sm"
            >
              Click to add content, or type / for commands...
            </button>
          )}

          {blocks.length > 0 && (
            <button
              onClick={(e) => handleShowBlockMenu(blocks[blocks.length - 1].id, e)}
              className="mt-2 text-gray-400 hover:text-gray-600 text-sm flex items-center gap-2 py-2"
            >
              <Plus className="w-4 h-4" />
              Add block
            </button>
          )}
        </div>
      </div>

      {/* Block type menu */}
      {showBlockMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowBlockMenu(false)}
          />
          <div
            className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-2 w-64"
            style={{ top: blockMenuPosition.top, left: blockMenuPosition.left }}
          >
            <div className="space-y-1">
              <button
                onClick={() => handleAddBlock('heading')}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 rounded text-left"
              >
                <Type className="w-4 h-4 text-gray-600" />
                <div>
                  <div className="text-sm font-medium">Heading</div>
                  <div className="text-xs text-gray-500">Large section heading</div>
                </div>
              </button>
              <button
                onClick={() => handleAddBlock('paragraph')}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 rounded text-left"
              >
                <FileText className="w-4 h-4 text-gray-600" />
                <div>
                  <div className="text-sm font-medium">Text</div>
                  <div className="text-xs text-gray-500">Plain text paragraph</div>
                </div>
              </button>
              <button
                onClick={() => handleAddBlock('callout')}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 rounded text-left"
              >
                <AlertCircle className="w-4 h-4 text-gray-600" />
                <div>
                  <div className="text-sm font-medium">Callout</div>
                  <div className="text-xs text-gray-500">Highlighted info box</div>
                </div>
              </button>
              <button
                onClick={() => handleAddBlock('image')}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 rounded text-left"
              >
                <ImageIcon className="w-4 h-4 text-gray-600" />
                <div>
                  <div className="text-sm font-medium">Image</div>
                  <div className="text-xs text-gray-500">Upload or embed image</div>
                </div>
              </button>
              <button
                onClick={() => handleAddBlock('divider')}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 rounded text-left"
              >
                <Minus className="w-4 h-4 text-gray-600" />
                <div>
                  <div className="text-sm font-medium">Divider</div>
                  <div className="text-xs text-gray-500">Visual separator</div>
                </div>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function getDefaultProps(type: string): Record<string, any> {
  switch (type) {
    case 'heading':
      return { text: 'Heading', level: 1, align: 'left' }
    case 'paragraph':
      return { text: 'Start writing...', align: 'left', size: 'base' }
    case 'callout':
      return { type: 'info', title: 'Note', text: 'Add your note here...', icon: true }
    case 'image':
      return { url: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=800', alt: 'Image', align: 'center' }
    case 'divider':
      return { color: '#e5e7eb', spacing: 'md' }
    default:
      return {}
  }
}
