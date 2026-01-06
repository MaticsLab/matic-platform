'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import { GripVertical, Trash2, ChevronUp, ChevronDown, BookOpen, CheckCircle, Eye, ScrollText, MoreVertical, LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui-components/button'
import { Section } from '@/types/portal'
import { SectionCollaboratorIndicator } from './PresenceIndicators'
import { getCollaborationActions } from '@/lib/collaboration/collaboration-store'
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
  
  // Update collaboration awareness when active section changes
  // Using getCollaborationActions() - this is a non-reactive getter that doesn't cause re-renders
  useEffect(() => {
    const { updateCurrentSection } = getCollaborationActions()
    if (activeId) {
      const activeSection = sections.find(s => s.id === activeId)
      updateCurrentSection(activeId, activeSection?.title || 'Untitled Section')
    }
  }, [activeId, sections])

  const variants = {
    form: { label: 'Form', description: 'Page to collect user input', icon: ScrollText, bg: 'bg-amber-50', fg: 'text-amber-600', border: 'border-amber-200', activeBg: 'bg-amber-100' },
    cover: { label: 'Cover', description: 'Welcome users to your form', icon: BookOpen, bg: 'bg-blue-50', fg: 'text-blue-600', border: 'border-blue-200', activeBg: 'bg-blue-100' },
    ending: { label: 'Ending', description: 'Show a thank you page or redirect users', icon: CheckCircle, bg: 'bg-emerald-50', fg: 'text-emerald-600', border: 'border-emerald-200', activeBg: 'bg-emerald-100' },
    review: { label: 'Review', description: 'Let users review their submission', icon: Eye, bg: 'bg-purple-50', fg: 'text-purple-600', border: 'border-purple-200', activeBg: 'bg-purple-100' },
    dashboard: { label: 'Dashboard', description: 'Additional info after submission', icon: LayoutDashboard, bg: 'bg-indigo-50', fg: 'text-indigo-600', border: 'border-indigo-200', activeBg: 'bg-indigo-100' },
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
      const newSections = Array.isArray(sections) ? sections.filter(s => s.id !== sectionId) : []
      onReorder(newSections)
    }
  }

  return (
    <div className="w-full max-w-full">
      <div className="space-y-1 px-2 py-2 w-full">
        <AnimatePresence mode="popLayout">
          {sections.map((section, index) => {
            const key: VariantKey = (section.sectionType ?? 'form') as VariantKey
            const variant = variants[key]
            const Icon = variant.icon
            const isActive = activeId === section.id

            return (
              <motion.div
                key={section.id}
                layout
                initial={{ opacity: 0, y: -10 }}
                animate={{ 
                  opacity: draggedIndex === index ? 0.5 : 1, 
                  y: 0,
                  scale: draggedIndex === index ? 1.02 : 1
                }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                draggable
                onDragStart={(e) => handleDragStart(e as any, index)}
                onDragOver={(e) => handleDragOver(e as any, index)}
                onDragEnd={handleDragEnd}
                onClick={() => onSelect(section.id)}
                className={cn(
                  "group w-full max-w-full flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all duration-150",
                  isActive 
                    ? cn("shadow-sm", variant.activeBg, variant.border, "border")
                    : "bg-white border border-transparent hover:border-gray-200 hover:shadow-sm"
                )}
              >
                {/* Drag Handle */}
                <div className={cn(
                  "opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing",
                  isActive && "opacity-60"
                )}>
                  <GripVertical className="w-3.5 h-3.5 text-gray-400" />
                </div>

                {/* Icon */}
                <div className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
                  isActive ? variant.activeBg : variant.bg
                )}>
                  <Icon className={cn("w-3.5 h-3.5", variant.fg)} />
                </div>

                {/* Title */}
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div 
                    className={cn(
                      "text-sm font-medium truncate transition-colors",
                      isActive ? "text-gray-900" : "text-gray-700"
                    )}
                    title={section.title || variant.label}
                  >
                    {section.title || variant.label}
                  </div>
                </div>

                {/* Collaborators editing this section */}
                <SectionCollaboratorIndicator sectionId={section.id} />

                {/* Actions Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-6 w-6 p-0 transition-opacity flex-shrink-0",
                        isActive ? "opacity-70 hover:opacity-100" : "opacity-0 group-hover:opacity-100"
                      )}
                    >
                      <MoreVertical className="w-3.5 h-3.5 text-gray-500" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem
                      disabled={index === 0}
                      onClick={(e) => {
                        e.stopPropagation()
                        moveSection(index, 'up')
                      }}
                      className="gap-2"
                    >
                      <ChevronUp className="w-4 h-4" />
                      Move Up
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={index === sections.length - 1}
                      onClick={(e) => {
                        e.stopPropagation()
                        moveSection(index, 'down')
                      }}
                      className="gap-2"
                    >
                      <ChevronDown className="w-4 h-4" />
                      Move Down
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={sections.length <= 1}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(section.id)
                      }}
                      className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Section
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
