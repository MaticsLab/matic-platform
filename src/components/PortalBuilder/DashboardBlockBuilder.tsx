'use client'

import { useState } from 'react'
import { DndContext, DragEndEvent, DragOverlay, useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  ListTodo, CheckCircle2, Clock, MessageSquare, FileText, Lightbulb,
  Plus, Settings, Trash2, GripVertical
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui-components/button'
import { DashboardBlock, DashboardBlockType } from '@/types/dashboard'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui-components/dropdown-menu'

const BLOCK_TYPES = [
  { type: 'tasks' as const, label: 'Tasks', icon: ListTodo, color: 'blue', description: 'What You Need To Do' },
  { type: 'status' as const, label: 'Status Card', icon: CheckCircle2, color: 'green', description: 'Application status' },
  { type: 'timeline' as const, label: 'Activity Timeline', icon: Clock, color: 'purple', description: 'History & updates' },
  { type: 'messages' as const, label: 'Messages', icon: MessageSquare, color: 'indigo', description: 'Two-way chat' },
  { type: 'documents' as const, label: 'Documents', icon: FileText, color: 'amber', description: 'File uploads' },
  { type: 'recommendations' as const, label: 'Recommendations', icon: Lightbulb, color: 'orange', description: 'AI suggestions' },
]

const GRID_COLS = 12
const GRID_ROWS = 12

interface DashboardBlockBuilderProps {
  blocks: DashboardBlock[]
  selectedBlockId: string | null
  onBlocksChange: (blocks: DashboardBlock[]) => void
  onSelectBlock: (blockId: string | null) => void
}

function GridCell({ col, row }: { col: number; row: number }) {
  const { isOver, setNodeRef } = useDroppable({
    id: `cell-${col}-${row}`,
    data: { col, row }
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "border border-gray-200 transition-colors",
        isOver && "bg-blue-50 border-blue-300"
      )}
    />
  )
}

function BlockItem({ block, isSelected, onSelect, onDelete }: {
  block: DashboardBlock
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const blockType = BLOCK_TYPES.find(t => t.type === block.type)
  const Icon = blockType?.icon || ListTodo

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: block.id,
    data: block
  })

  const style = transform ? {
    transform: CSS.Translate.toString(transform),
  } : undefined

  // Calculate grid position
  const gridColumn = `${block.x + 1} / span ${block.width}`
  const gridRow = `${block.y + 1} / span ${block.height}`

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        gridColumn,
        gridRow,
        opacity: isDragging ? 0.5 : 1
      }}
      onClick={onSelect}
      className={cn(
        "rounded-lg border-2 p-4 cursor-pointer transition-all relative group",
        isSelected 
          ? "border-blue-500 bg-blue-50 shadow-lg ring-2 ring-blue-200" 
          : "border-gray-300 bg-white hover:border-gray-400 hover:shadow-md"
      )}
    >
      {/* Drag handle */}
      <div 
        {...listeners} 
        {...attributes}
        className="absolute top-2 left-2 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <GripVertical className="w-4 h-4 text-gray-400" />
      </div>

      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-100 rounded"
      >
        <Trash2 className="w-3.5 h-3.5 text-red-500" />
      </button>

      {/* Block content */}
      <div className="flex flex-col items-center justify-center h-full text-center gap-2">
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center",
          `bg-${blockType?.color}-100`
        )}>
          <Icon className={cn("w-5 h-5", `text-${blockType?.color}-600`)} />
        </div>
        <div>
          <p className="font-medium text-sm text-gray-900">{blockType?.label}</p>
          <p className="text-xs text-gray-500">{block.width}×{block.height}</p>
        </div>
      </div>

      {/* Settings indicator */}
      {isSelected && (
        <div className="absolute bottom-2 right-2">
          <Settings className="w-3.5 h-3.5 text-blue-500" />
        </div>
      )}
    </div>
  )
}

export function DashboardBlockBuilder({
  blocks,
  selectedBlockId,
  onBlocksChange,
  onSelectBlock
}: DashboardBlockBuilderProps) {
  const [isDraggingNew, setIsDraggingNew] = useState(false)

  const handleAddBlock = (type: DashboardBlockType) => {
    // Find first available space in grid
    const occupied = new Set(blocks.flatMap(b => 
      Array.from({ length: b.height }, (_, dy) =>
        Array.from({ length: b.width }, (_, dx) => 
          `${b.x + dx},${b.y + dy}`
        )
      ).flat()
    ))

    let x = 0, y = 0
    const defaultWidth = type === 'tasks' ? 6 : type === 'status' ? 4 : 6
    const defaultHeight = type === 'timeline' ? 4 : 2

    // Find first open spot
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS - defaultWidth + 1; col++) {
        const fits = Array.from({ length: defaultHeight }, (_, dy) =>
          Array.from({ length: defaultWidth }, (_, dx) => 
            !occupied.has(`${col + dx},${row + dy}`)
          )
        ).flat().every(Boolean)

        if (fits) {
          x = col
          y = row
          row = GRID_ROWS // Break outer loop
          break
        }
      }
    }

    const newBlock: DashboardBlock = {
      id: `block-${Date.now()}`,
      type,
      x,
      y,
      width: defaultWidth,
      height: defaultHeight,
      settings: {}
    }

    onBlocksChange([...blocks, newBlock])
    onSelectBlock(newBlock.id)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return

    const blockId = active.id as string
    const block = blocks.find(b => b.id === blockId)
    if (!block) return

    // Parse target cell
    const cellId = over.id as string
    if (!cellId.startsWith('cell-')) return

    const [, colStr, rowStr] = cellId.split('-')
    const newX = parseInt(colStr)
    const newY = parseInt(rowStr)

    // Update block position
    onBlocksChange(blocks.map(b => 
      b.id === blockId ? { ...b, x: newX, y: newY } : b
    ))
  }

  const handleDeleteBlock = (blockId: string) => {
    onBlocksChange(blocks.filter(b => b.id !== blockId))
    if (selectedBlockId === blockId) {
      onSelectBlock(null)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="p-4 border-b bg-white flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Dashboard Layout</h3>
          <p className="text-xs text-gray-500">Drag and drop blocks to build your dashboard</p>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Block
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {BLOCK_TYPES.map(blockType => {
              const Icon = blockType.icon
              return (
                <DropdownMenuItem
                  key={blockType.type}
                  onClick={() => handleAddBlock(blockType.type)}
                  className="flex items-start gap-3 p-3"
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    `bg-${blockType.color}-100`
                  )}>
                    <Icon className={cn("w-4 h-4", `text-${blockType.color}-600`)} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{blockType.label}</p>
                    <p className="text-xs text-gray-500">{blockType.description}</p>
                  </div>
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Grid Canvas */}
      <div className="flex-1 overflow-auto p-8 bg-gray-50">
        <DndContext onDragEnd={handleDragEnd}>
          <div 
            className="grid gap-0 bg-white rounded-lg border-2 border-gray-300 overflow-hidden shadow-sm mx-auto"
            style={{
              gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${GRID_ROWS}, 60px)`,
              maxWidth: '1200px'
            }}
          >
            {/* Background grid cells */}
            {Array.from({ length: GRID_ROWS }, (_, row) =>
              Array.from({ length: GRID_COLS }, (_, col) => (
                <GridCell key={`${col}-${row}`} col={col} row={row} />
              ))
            )}

            {/* Blocks */}
            {blocks.map(block => (
              <BlockItem
                key={block.id}
                block={block}
                isSelected={selectedBlockId === block.id}
                onSelect={() => onSelectBlock(block.id)}
                onDelete={() => handleDeleteBlock(block.id)}
              />
            ))}
          </div>
        </DndContext>
      </div>

      {/* Empty state */}
      {blocks.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium mb-1">No blocks added yet</p>
            <p className="text-sm text-gray-400">Click "Add Block" to get started</p>
          </div>
        </div>
      )}
    </div>
  )
}
