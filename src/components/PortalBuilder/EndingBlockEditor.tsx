/**
 * Ending Block Editor - Drag-and-drop editor for ending page blocks
 */

'use client'

import React, { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BlockRenderer } from '@/components/EndingPages/BlockRenderer'
import type { EndingBlock } from '@/types/ending-blocks'

interface EndingBlockEditorProps {
  blocks: EndingBlock[]
  onUpdate: (blocks: EndingBlock[]) => void
  selectedBlockId: string | null
  onSelectBlock: (id: string | null) => void
  onDeleteBlock: (id: string) => void
}

interface SortableBlockProps {
  block: EndingBlock
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
}

function SortableBlock({ block, isSelected, onSelect, onDelete }: SortableBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group rounded-lg transition-all",
        isSelected ? "ring-2 ring-blue-500" : "hover:ring-1 hover:ring-gray-300",
        isDragging && "opacity-50"
      )}
      onClick={onSelect}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-8 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
      >
        <div className="p-1.5 bg-white rounded shadow-sm border border-gray-200">
          <GripVertical className="w-4 h-4 text-gray-400" />
        </div>
      </div>

      {/* Block Content */}
      <div className="pointer-events-none">
        <BlockRenderer block={block} />
      </div>

      {/* Delete Button */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="p-1.5 bg-white rounded shadow-sm hover:bg-red-50 text-red-600 border border-gray-200"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export function EndingBlockEditor({
  blocks,
  onUpdate,
  selectedBlockId,
  onSelectBlock,
  onDeleteBlock,
}: EndingBlockEditorProps) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragStart = (event: DragEndEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = blocks.findIndex((b) => b.id === active.id)
      const newIndex = blocks.findIndex((b) => b.id === over.id)

      const newBlocks = arrayMove(blocks, oldIndex, newIndex)
      // Update order metadata
      const reorderedBlocks = newBlocks.map((block, index) => ({
        ...block,
        metadata: { ...block.metadata, order: index }
      }))
      onUpdate(reorderedBlocks)
    }

    setActiveId(null)
  }

  const activeBlock = activeId ? blocks.find((b) => b.id === activeId) : null

  return (
    <div className="h-full overflow-auto bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm p-8 pl-16">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={blocks.map((b) => b.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-4">
              {blocks.map((block) => (
                <SortableBlock
                  key={block.id}
                  block={block}
                  isSelected={selectedBlockId === block.id}
                  onSelect={() => onSelectBlock(block.id)}
                  onDelete={() => onDeleteBlock(block.id)}
                />
              ))}
              {blocks.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-sm">No blocks yet. Add blocks from the Fields tab.</p>
                </div>
              )}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeBlock ? (
              <div className="bg-white rounded-lg shadow-lg p-4 opacity-80">
                <BlockRenderer block={activeBlock} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  )
}
