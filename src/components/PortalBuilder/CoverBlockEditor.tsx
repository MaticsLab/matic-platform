/**
 * Cover Block Editor - Drag-and-drop editor for cover page blocks
 * Similar to EndingBlockEditor but for cover/welcome pages
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

interface CoverBlockEditorProps {
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

export function CoverBlockEditor({
  blocks,
  onUpdate,
  selectedBlockId,
  onSelectBlock,
  onDeleteBlock,
}: CoverBlockEditorProps) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
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

      if (oldIndex !== -1 && newIndex !== -1) {
        onUpdate(arrayMove(blocks, oldIndex, newIndex))
      }
    }

    setActiveId(null)
  }

  const activeBlock = blocks.find((b) => b.id === activeId)

  return (
    <div className="w-full h-full bg-white">
      {/* Notion-style full-width container */}
      <div className="max-w-[900px] mx-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2 pl-12 pr-8 pt-24 pb-24">
              {blocks.map((block) => (
                <SortableBlock
                  key={block.id}
                  block={block}
                  isSelected={selectedBlockId === block.id}
                  onSelect={() => onSelectBlock(block.id)}
                  onDelete={() => onDeleteBlock(block.id)}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeBlock ? (
              <div className="opacity-50">
                <BlockRenderer block={activeBlock} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {blocks.length === 0 && (
          <div className="text-center py-24 px-8 text-gray-400">
            <p className="text-lg font-medium mb-2">Empty page</p>
            <p className="text-sm">Add blocks from the sidebar to build your cover page</p>
          </div>
        )}
      </div>
    </div>
  )
}
