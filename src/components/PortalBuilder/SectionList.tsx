'use client'

import { GripVertical, MoreVertical, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui-components/button'
import { Section } from '@/types/portal'

interface SectionListProps {
  sections: Section[]
  activeId: string
  onSelect: (id: string) => void
  onReorder: (sections: Section[]) => void
}

export function SectionList({ sections, activeId, onSelect, onReorder }: SectionListProps) {
  return (
    <div className="space-y-1 p-2">
      {sections.map((section, index) => (
        <div
          key={section.id}
          onClick={() => onSelect(section.id)}
          className={cn(
            "group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors",
            activeId === section.id 
              ? "bg-blue-50 text-blue-700" 
              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          )}
        >
          <GripVertical className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 cursor-grab" />
          <span className="flex-1 truncate">{section.title}</span>
          <div className="opacity-0 group-hover:opacity-100 flex items-center">
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-gray-400 hover:text-red-500">
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
