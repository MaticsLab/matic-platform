'use client'

import { useState } from 'react'
import { GripVertical, Trash2, ChevronUp, ChevronDown, BookOpen, CheckCircle, Eye, ScrollText, MoreVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui-components/button'
import { Section } from '@/types/portal'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui-components/dropdown-menu'

interface SectionListProps {
  sections: Section[]
  activeId: string
  onSelect: (id: string) => void
  onReorder: (sections: Section[]) => void
  onDelete?: (sectionId: string) => void
}

export function SectionList({ sections, activeId, onSelect, onReorder, onDelete }: SectionListProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const variants = {
    form: { label: 'Form', description: 'Page to collect user input', icon: ScrollText, bg: 'bg-amber-50', fg: 'text-amber-700', border: 'border-amber-100' },
    cover: { label: 'Cover', description: 'Welcome users to your form', icon: BookOpen, bg: 'bg-blue-50', fg: 'text-blue-700', border: 'border-blue-100' },
    ending: { label: 'Ending', description: 'Show a thank you page or redirect users', icon: CheckCircle, bg: 'bg-rose-50', fg: 'text-rose-700', border: 'border-rose-100' },
    review: { label: 'Review', description: 'Let users review their submission', icon: Eye, bg: 'bg-purple-50', fg: 'text-purple-700', border: 'border-purple-100' },
  } as const
  type VariantKey = keyof typeof variants

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', index.toString())
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return
    
    const newSections = [...sections]
    const draggedSection = newSections[draggedIndex]
    newSections.splice(draggedIndex, 1)
    newSections.splice(index, 0, draggedSection)
    
    setDraggedIndex(index)
    onReorder(newSections)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const moveSection = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= sections.length) return
    
    const newSections = [...sections]
    const temp = newSections[index]
    newSections[index] = newSections[newIndex]
    newSections[newIndex] = temp
    onReorder(newSections)
  }

  const handleDelete = (sectionId: string) => {
    if (sections.length <= 1) return
    if (onDelete) {
      onDelete(sectionId)
    } else {
      const newSections = sections.filter(s => s.id !== sectionId)
      onReorder(newSections)
    }
  }

  return (
    <div className="w-full max-w-full">
      <div className="space-y-1.5 px-3 py-3 w-full">
        {sections.map((section, index) => {
          const key: VariantKey = (section.sectionType ?? 'form') as VariantKey
          const variant = variants[key]
          const Icon = variant.icon

          return (
            <div
              key={section.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              onClick={() => onSelect(section.id)}
              className={cn(
                "group w-full max-w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-all border",
                activeId === section.id 
                  ? "bg-blue-50 border-blue-200 shadow-sm" 
                  : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm",
                draggedIndex === index && "opacity-50"
              )}
            >
              <GripVertical className="w-3 h-3 text-gray-400 cursor-grab flex-shrink-0" />
              <div className={cn("w-5 h-5 rounded flex items-center justify-center flex-shrink-0", variant.bg)}>
                <Icon className={cn("w-3 h-3", variant.fg)} />
              </div>
              <div className="flex-1 min-w-0 overflow-hidden pr-1">
                <div className="text-xs font-medium text-gray-900 truncate">
                  {section.title || variant.label}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  >
                    <MoreVertical className="w-3 h-3 text-gray-500" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem
                    disabled={index === 0}
                    onClick={(e) => {
                      e.stopPropagation()
                      moveSection(index, 'up')
                    }}
                  >
                    <ChevronUp className="w-4 h-4 mr-2" />
                    Move Up
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={index === sections.length - 1}
                    onClick={(e) => {
                      e.stopPropagation()
                      moveSection(index, 'down')
                    }}
                  >
                    <ChevronDown className="w-4 h-4 mr-2" />
                    Move Down
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={sections.length <= 1}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(section.id)
                    }}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        })}
      </div>
    </div>
  )
}
