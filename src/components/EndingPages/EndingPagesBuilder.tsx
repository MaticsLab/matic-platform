/**
 * Ending Pages Builder - Main component for editing ending pages
 */

'use client'

import React, { useState, useEffect } from 'react'
import { EndingPageConfig, EndingBlock } from '@/types/ending-blocks'
import { ENDING_BLOCK_REGISTRY, getAvailableCategories, getBlocksByCategory } from '@/lib/ending-block-registry'
import { BlockEditor } from './BlockEditor'
import { BlockRenderer, EndingPageRenderer } from './BlockRenderer'
import { endingPagesClient } from '@/lib/api/ending-pages-client'
import { Button } from '@/ui-components/button'
import { Plus, Save, Star, GripVertical, ChevronUp, ChevronDown } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui-components/tabs'
import { v4 as uuid } from 'uuid'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface EndingPagesBuilderProps {
  formId: string
  onSave?: (endingPage: EndingPageConfig) => Promise<void>
  initialEnding?: EndingPageConfig
}

export function EndingPagesBuilder({
  formId,
  onSave,
  initialEnding
}: EndingPagesBuilderProps) {
  const [ending, setEnding] = useState<EndingPageConfig>(
    initialEnding || {
      id: uuid(),
      formId: formId,
      name: 'Default Ending',
      blocks: [],
      settings: {
        layout: 'centered',
        maxWidth: 600,
        padding: { top: 40, right: 20, bottom: 40, left: 20 },
        backgroundColor: '#ffffff'
      },
      theme: {
        colorPrimary: '#2563eb',
        colorSecondary: '#64748b',
        colorText: '#1f2937',
        colorSubtext: '#6b7280',
        fontFamily: 'inter',
        borderRadius: 8
      },
      version: 1,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  )

  const [showBlockMenu, setShowBlockMenu] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number | null>(null)
  const [endings, setEndings] = useState<EndingPageConfig[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editorTab, setEditorTab] = useState<'blocks' | 'preview'>('blocks')

  // Load existing endings
  useEffect(() => {
    const loadEndings = async () => {
      try {
        const list = await endingPagesClient.listByForm(formId)
        setEndings(list || [])
      } catch (error) {
        console.warn('Failed to load endings:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadEndings()
  }, [formId])

  const handleAddBlock = (blockType: string) => {
    const newBlock: EndingBlock = {
      id: uuid(),
      blockType,
      props: ENDING_BLOCK_REGISTRY[blockType]?.defaultProps || {},
      metadata: {
        order: ending.blocks.length
      }
    }

    setEnding({
      ...ending,
      blocks: [...ending.blocks, newBlock]
    })
    setShowBlockMenu(false)
  }

  const handleUpdateBlock = (index: number, updatedBlock: EndingBlock) => {
    const newBlocks = [...ending.blocks]
    newBlocks[index] = updatedBlock
    setEnding({ ...ending, blocks: newBlocks })
  }

  const handleDeleteBlock = (index: number) => {
    setEnding({
      ...ending,
      blocks: ending.blocks.filter((_, i) => i !== index).map((b, i) => ({
        ...b,
        metadata: { ...b.metadata, order: i }
      }))
    })
    setSelectedBlockIndex(null)
  }

  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    const newBlocks = [...ending.blocks]
    if (direction === 'up' && index > 0) {
      [newBlocks[index], newBlocks[index - 1]] = [newBlocks[index - 1], newBlocks[index]]
    } else if (direction === 'down' && index < newBlocks.length - 1) {
      [newBlocks[index], newBlocks[index + 1]] = [newBlocks[index + 1], newBlocks[index]]
    }
    newBlocks.forEach((b, i) => {
      b.metadata.order = i
    })
    setEnding({ ...ending, blocks: newBlocks })
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      if (onSave) {
        await onSave({
          ...ending,
          updatedAt: new Date().toISOString(),
          status: 'published'
        })
      }
      toast.success('Ending page saved successfully')
    } catch (error) {
      toast.error('Failed to save ending page')
      console.error(error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSetDefault = async (endingId: string) => {
    try {
      const updated = await endingPagesClient.setDefault(endingId)
      // Update local state
      setEndings(prev => prev.map(e => ({
        ...e,
        isDefault: e.id === endingId
      })))
      if (ending.id === endingId) {
        setEnding({ ...ending, isDefault: true })
      }
      toast.success('Default ending updated')
    } catch (error) {
      toast.error('Failed to set default ending')
      console.error(error)
    }
  }

  const handleMoveEnding = async (index: number, direction: 'up' | 'down') => {
    const newEndings = [...endings]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    
    if (targetIndex < 0 || targetIndex >= newEndings.length) return
    
    // Swap
    [newEndings[index], newEndings[targetIndex]] = [newEndings[targetIndex], newEndings[index]]
    
    // Update priorities based on new order
    const order = newEndings.map((e, i) => ({ endingId: e.id, priority: i }))
    
    try {
      const reordered = await endingPagesClient.reorder(formId, order)
      setEndings(reordered)
      toast.success('Order updated')
    } catch (error) {
      toast.error('Failed to reorder endings')
      console.error(error)
    }
  }

  const createNewEnding = () => {
    const newEnding: EndingPageConfig = {
      id: uuid(),
      formId: formId,
      name: 'New Ending',
      blocks: [],
      settings: {
        layout: 'centered',
        maxWidth: 600,
        padding: { top: 40, right: 20, bottom: 40, left: 20 },
        backgroundColor: '#ffffff'
      },
      theme: {
        colorPrimary: '#2563eb',
        colorSecondary: '#64748b',
        colorText: '#1f2937',
        colorSubtext: '#6b7280',
        fontFamily: 'inter',
        borderRadius: 8
      },
      version: 1,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    setEnding(newEnding)
    setEndings([...endings, newEnding])
    setSelectedBlockIndex(null)
    setEditorTab('blocks')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Loading endings...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-white">
        <div>
          <h2 className="text-2xl font-bold">Ending Pages</h2>
          <p className="text-sm text-gray-600">Create customized pages shown after form submission</p>
        </div>
        <Button onClick={createNewEnding} className="gap-2">
          <Plus className="w-4 h-4" />
          New Ending
        </Button>
      </div>

      {/* Main Content - 4 Column Layout */}
      <div className="flex-1 overflow-hidden flex gap-4 p-4">
        {/* Column 1: Endings List (1/4) */}
        <div className="w-1/4 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-sm">Your Endings ({endings.length})</h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            {endings.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">
                <p>No endings yet</p>
                <p className="text-xs mt-2">Click "New Ending" to create one</p>
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {endings.map((e, index) => (
                  <div
                    key={e.id}
                    className={cn(
                      "group relative flex items-center gap-2 px-2 py-2 rounded text-sm transition-colors",
                      ending.id === e.id
                        ? 'bg-blue-100 text-blue-900'
                        : 'hover:bg-gray-100'
                    )}
                  >
                    {/* Reorder controls */}
                    <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(ev) => { ev.stopPropagation(); handleMoveEnding(index, 'up') }}
                        disabled={index === 0}
                        className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30"
                        title="Move up"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(ev) => { ev.stopPropagation(); handleMoveEnding(index, 'down') }}
                        disabled={index === endings.length - 1}
                        className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30"
                        title="Move down"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                    
                    {/* Main content */}
                    <button
                      onClick={() => {
                        setEnding(e)
                        setSelectedBlockIndex(null)
                        setEditorTab('blocks')
                      }}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium truncate">{e.name}</span>
                        {e.isDefault && (
                          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{e.blocks.length} blocks</span>
                        <span>•</span>
                        <span className={e.status === 'published' ? 'text-green-600' : 'text-gray-400'}>
                          {e.status}
                        </span>
                      </div>
                    </button>
                    
                    {/* Set as default button */}
                    {!e.isDefault && e.status === 'published' && (
                      <button
                        onClick={(ev) => { ev.stopPropagation(); handleSetDefault(e.id) }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-opacity"
                        title="Set as primary ending"
                      >
                        <Star className="w-3.5 h-3.5 text-gray-400" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Priority info */}
          <div className="p-3 border-t border-gray-200 bg-gray-50">
            <p className="text-xs text-gray-500">
              <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 inline mr-1" />
              Primary ending shows when no rules match
            </p>
          </div>
        </div>

        {/* Columns 2-4: Editor Area (3/4) */}
        <div className="flex-1 flex flex-col gap-4 min-h-0">
          {/* Editor Header */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold">{ending.name}</h3>
              <p className="text-xs text-gray-500">
                {ending.status} • Version {ending.version}
              </p>
            </div>
            <Button
              onClick={handleSave}
              disabled={isSaving || ending.blocks.length === 0}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Ending'}
            </Button>
          </div>

          {/* Editor Tabs */}
          <Tabs value={editorTab} onValueChange={(v) => setEditorTab(v as 'blocks' | 'preview')} className="flex-1 flex flex-col">
            <TabsList className="w-fit">
              <TabsTrigger value="blocks">Blocks</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>

            {/* Blocks Tab */}
            <TabsContent value="blocks" className="flex-1 overflow-hidden flex gap-4">
              {/* Blocks Panel (Column 2) */}
              <div className="w-1/2 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col">
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-sm">Blocks ({ending.blocks.length})</h4>
                    <button
                      onClick={() => setShowBlockMenu(!showBlockMenu)}
                      className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      title="Add block"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Block Menu */}
                  {showBlockMenu && (
                    <div className="space-y-3 mb-4 pb-4 border-t border-gray-200 pt-4">
                      {getAvailableCategories().map((category) => (
                        <div key={category}>
                          <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">
                            {category}
                          </h4>
                          <div className="space-y-1">
                            {getBlocksByCategory(category).map(([blockType, def]) => (
                              <button
                                key={blockType}
                                onClick={() => handleAddBlock(blockType)}
                                className="w-full text-left px-2 py-1.5 text-xs hover:bg-blue-50 rounded transition-colors"
                              >
                                {def.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Blocks List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {ending.blocks.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-8">
                      No blocks yet. Add one to get started!
                    </p>
                  ) : (
                    ending.blocks.map((block, index) => (
                      <button
                        key={block.id}
                        onClick={() => setSelectedBlockIndex(selectedBlockIndex === index ? null : index)}
                        className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                          selectedBlockIndex === index
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        } ${block.metadata?.hidden ? 'opacity-50' : ''}`}
                      >
                        <div className="font-medium text-sm">
                          {ENDING_BLOCK_REGISTRY[block.blockType]?.label || block.blockType}
                        </div>
                        <div className="text-xs text-gray-500">
                          {block.props?.text ||
                            block.props?.name ||
                            `Block ${index + 1}`}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Editor Panel (Column 3-4) */}
              <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col">
                {selectedBlockIndex !== null &&
                selectedBlockIndex < ending.blocks.length ? (
                  <div className="flex-1 overflow-y-auto p-4">
                    <BlockEditor
                      block={ending.blocks[selectedBlockIndex]}
                      onUpdate={(updated) =>
                        handleUpdateBlock(selectedBlockIndex, updated)
                      }
                      onDelete={() => handleDeleteBlock(selectedBlockIndex)}
                      onMoveUp={() => handleMoveBlock(selectedBlockIndex, 'up')}
                      onMoveDown={() =>
                        handleMoveBlock(selectedBlockIndex, 'down')
                      }
                      canMoveUp={selectedBlockIndex > 0}
                      canMoveDown={selectedBlockIndex < ending.blocks.length - 1}
                    />
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-500">
                    <p>Select a block to edit or add a new one</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Preview Tab */}
            <TabsContent value="preview" className="flex-1 overflow-hidden">
              <div className="h-full bg-white rounded-lg border border-gray-200 overflow-y-auto p-4">
                <div className="flex justify-center">
                  <div
                    className="bg-gray-100 rounded-lg shadow-sm p-8"
                    style={{
                      maxWidth: `${ending.settings?.maxWidth}px`,
                      width: '100%'
                    }}
                  >
                    <EndingPageRenderer config={ending} />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
