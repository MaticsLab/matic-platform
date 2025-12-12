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
import { Plus, Save, X } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui-components/tabs'
import { v4 as uuid } from 'uuid'
import { toast } from 'sonner'

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
              <div className="space-y-2 p-2">
                {endings.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => {
                      setEnding(e)
                      setSelectedBlockIndex(null)
                      setEditorTab('blocks')
                    }}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                      ending.id === e.id
                        ? 'bg-blue-100 text-blue-900'
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    <div className="font-medium truncate">{e.name}</div>
                    <div className="text-xs text-gray-500 truncate">{e.blocks.length} blocks</div>
                  </button>
                ))}
              </div>
            )}
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
