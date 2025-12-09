'use client'

import { useState } from 'react'
import { GripVertical, Trash2, ChevronUp, ChevronDown, BookOpen, CheckCircle, Eye, ScrollText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui-components/button'
import { Section } from '@/types/portal'

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

  const handleDelete = (e: React.MouseEvent, sectionId: string) => {
    e.stopPropagation()
    if (sections.length <= 1) return // Don't delete the last section
    if (onDelete) {
      onDelete(sectionId)
    } else {
      // Fallback: filter out the section
      const newSections = sections.filter(s => s.id !== sectionId)
      onReorder(newSections)
    }
  }

  return (
    <div className="space-y-0.5 px-3 pb-3">
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
          title={section.title || variant.label}
          className={cn(
            "group flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm cursor-pointer transition-colors",
            activeId === section.id 
              ? "bg-blue-50 text-blue-900" 
              : "text-gray-700 hover:bg-gray-50",
            draggedIndex === index && "opacity-50"
          )}
        >
          <GripVertical className="w-3.5 h-3.5 text-gray-400 cursor-grab flex-shrink-0" />
          <Icon className={cn("w-4 h-4 flex-shrink-0", variant.fg)} />
          <span className="flex-1 min-w-0 truncate font-medium pr-1">{section.title || variant.label}</span>
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 flex-shrink-0">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-5 w-5 p-0 text-gray-400 hover:text-gray-600"
              onClick={(e) => { e.stopPropagation(); moveSection(index, 'up') }}
              disabled={index === 0}
            >
              <ChevronUp className="w-3 h-3" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-5 w-5 p-0 text-gray-400 hover:text-gray-600"
              onClick={(e) => { e.stopPropagation(); moveSection(index, 'down') }}
              disabled={index === sections.length - 1}
            >
              <ChevronDown className="w-3 h-3" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn(
                "h-5 w-5 p-0 text-gray-400 hover:text-red-500",
                sections.length <= 1 && "opacity-30 cursor-not-allowed hover:text-gray-400"
              )}
              onClick={(e) => handleDelete(e, section.id)}
              disabled={sections.length <= 1}
              title={sections.length <= 1 ? "Cannot delete the last section" : "Delete section"}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )})}
    </div>
  )
}
