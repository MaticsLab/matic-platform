import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Type, AlignLeft, Hash, Mail, Calendar, CheckSquare, List, Image as ImageIcon,
  Phone, Link, Clock, PenTool, Star, Minus, Heading, Pilcrow, CheckCircle2, Layers, Search, ArrowUpDown,
  FileUp, CalendarClock, LucideIcon, MapPin, Lightbulb, Repeat, Sparkles, X
} from 'lucide-react'
import { Input } from '@/ui-components/input'
import { FieldType } from '@/types/portal'
import { cn } from '@/lib/utils'

// Type for field group items
interface FieldGroupItem {
  type: string
  label: string
  icon: LucideIcon
  description?: string
  color?: string
}

interface FieldGroup {
  title: string
  icon: LucideIcon
  color: string
  items: FieldGroupItem[]
}

// Static field groups - the source of truth for the Portal Builder
const STATIC_FIELD_GROUPS: FieldGroup[] = [
  {
    title: 'Basic Fields',
    icon: Type,
    color: 'blue',
    items: [
      { type: 'text', label: 'Short Text', icon: Type, color: 'blue' },
      { type: 'textarea', label: 'Long Text', icon: AlignLeft, color: 'blue' },
      { type: 'number', label: 'Number', icon: Hash, color: 'blue' },
      { type: 'email', label: 'Email', icon: Mail, color: 'blue' },
      { type: 'phone', label: 'Phone', icon: Phone, color: 'blue' },
      { type: 'url', label: 'URL', icon: Link, color: 'blue' },
      { type: 'address', label: 'Address', icon: MapPin, description: 'Address with autocomplete', color: 'blue' },
    ]
  },
  {
    title: 'Selection',
    icon: List,
    color: 'emerald',
    items: [
      { type: 'select', label: 'Dropdown', icon: List, color: 'emerald' },
      { type: 'multiselect', label: 'Multi-Select', icon: List, color: 'emerald' },
      { type: 'radio', label: 'Single Choice', icon: CheckCircle2, color: 'emerald' },
      { type: 'checkbox', label: 'Checkbox', icon: CheckSquare, color: 'emerald' },
      { type: 'rank', label: 'Rank', icon: ArrowUpDown, color: 'emerald' },
    ]
  },
  {
    title: 'Date & Time',
    icon: Calendar,
    color: 'amber',
    items: [
      { type: 'date', label: 'Date', icon: Calendar, color: 'amber' },
      { type: 'datetime', label: 'Date & Time', icon: CalendarClock, color: 'amber' },
      { type: 'time', label: 'Time', icon: Clock, color: 'amber' },
    ]
  },
  {
    title: 'Media & Files',
    icon: ImageIcon,
    color: 'rose',
    items: [
      { type: 'file', label: 'File Upload', icon: FileUp, color: 'rose' },
      { type: 'image', label: 'Image Upload', icon: ImageIcon, color: 'rose' },
      { type: 'signature', label: 'Signature', icon: PenTool, color: 'rose' },
      { type: 'rating', label: 'Rating', icon: Star, color: 'rose' },
    ]
  },
  {
    title: 'Layout',
    icon: Pilcrow,
    color: 'violet',
    items: [
      { type: 'heading', label: 'Heading', icon: Heading, description: 'Section title or heading text', color: 'violet' },
      { type: 'paragraph', label: 'Paragraph', icon: Pilcrow, description: 'Rich text with formatting', color: 'violet' },
      { type: 'callout', label: 'Callout Box', icon: Lightbulb, description: 'Highlighted info box with icon', color: 'violet' },
      { type: 'divider', label: 'Divider', icon: Minus, description: 'Visual separator line', color: 'violet' },
    ]
  },
  {
    title: 'Containers',
    icon: Layers,
    color: 'cyan',
    items: [
      { type: 'group', label: 'Field Group', icon: Layers, description: 'Group related fields together', color: 'cyan' },
      { type: 'repeater', label: 'Repeater', icon: Repeat, description: 'Repeating field set', color: 'cyan' },
    ]
  }
]

const colorClasses: Record<string, { bg: string; bgHover: string; text: string; border: string }> = {
  blue: { bg: 'bg-blue-50', bgHover: 'hover:bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' },
  emerald: { bg: 'bg-emerald-50', bgHover: 'hover:bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-200' },
  amber: { bg: 'bg-amber-50', bgHover: 'hover:bg-amber-100', text: 'text-amber-600', border: 'border-amber-200' },
  rose: { bg: 'bg-rose-50', bgHover: 'hover:bg-rose-100', text: 'text-rose-600', border: 'border-rose-200' },
  violet: { bg: 'bg-violet-50', bgHover: 'hover:bg-violet-100', text: 'text-violet-600', border: 'border-violet-200' },
  cyan: { bg: 'bg-cyan-50', bgHover: 'hover:bg-cyan-100', text: 'text-cyan-600', border: 'border-cyan-200' },
}

interface FieldToolboxProps {
  onAddField: (type: FieldType) => void
}

export function FieldToolbox({ onAddField }: FieldToolboxProps) {
  const [searchQuery, setSearchQuery] = useState('')

  // Always use the static field groups - they are the source of truth
  // The API registry is for backend validation, not for driving the UI
  const fieldGroups = STATIC_FIELD_GROUPS

  // Filter fields by search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return fieldGroups

    const query = searchQuery.toLowerCase()
    return fieldGroups
      .map(group => ({
        ...group,
        items: group.items.filter((item) => 
          item.label.toLowerCase().includes(query) ||
          item.type.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query)
        )
      }))
      .filter(group => group.items.length > 0)
  }, [fieldGroups, searchQuery])

  const totalResults = filteredGroups.reduce((acc, g) => acc + g.items.length, 0)

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Search Header */}
      <div className="p-4 pb-3 border-b border-gray-100">
         <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Search fields..." 
              className="pl-9 pr-9 h-10 bg-gray-50 border-gray-200 focus:bg-white transition-colors rounded-lg"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
         </div>
         {searchQuery && (
           <p className="text-xs text-gray-500 mt-2 px-1">
             {totalResults} result{totalResults !== 1 ? 's' : ''} for &ldquo;{searchQuery}&rdquo;
           </p>
         )}
      </div>

      {/* Fields Grid */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {filteredGroups.length > 0 ? (
            <motion.div 
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4 space-y-5"
            >
              {filteredGroups.map((group, groupIdx) => {
                const GroupIcon = group.icon
                const colors = colorClasses[group.color]
                
                return (
                  <motion.div 
                    key={group.title}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: groupIdx * 0.05 }}
                    className="space-y-2.5"
                  >
                    {/* Group Header */}
                    <div className="flex items-center gap-2 px-1">
                      <div className={cn("p-1 rounded", colors.bg)}>
                        <GroupIcon className={cn("w-3 h-3", colors.text)} />
                      </div>
                      <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        {group.title}
                      </h4>
                      <span className="text-[10px] text-gray-400 font-medium">{group.items.length}</span>
                    </div>
                    
                    {/* Fields Grid */}
                    <div className="grid grid-cols-2 gap-2">
                      {group.items.map((item, itemIdx) => {
                        const Icon = item.icon
                        const itemColors = colorClasses[item.color || group.color]
                        
                        return (
                          <motion.button
                            key={item.type}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: groupIdx * 0.05 + itemIdx * 0.02 }}
                            whileHover={{ scale: 1.02, y: -1 }}
                            whileTap={{ scale: 0.98 }}
                            className={cn(
                              "flex flex-col items-center justify-center gap-2 p-3.5 bg-white border rounded-xl",
                              "hover:shadow-md hover:border-gray-300 transition-all duration-150 text-center group cursor-pointer",
                              "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                            )}
                            onClick={() => onAddField(item.type as FieldType)}
                            title={item.description}
                          >
                            <div className={cn(
                              "p-2.5 rounded-lg transition-all duration-150",
                              itemColors.bg,
                              itemColors.bgHover
                            )}>
                              <Icon className={cn("w-5 h-5", itemColors.text)} />
                            </div>
                            <span className="text-xs font-medium text-gray-700 group-hover:text-gray-900">
                              {item.label}
                            </span>
                          </motion.button>
                        )
                      })}
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          ) : (
            <motion.div 
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center text-center py-16 px-6"
            >
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-600 mb-1">No fields found</p>
              <p className="text-xs text-gray-400">Try a different search term</p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-4 text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear search
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Footer Tip */}
      <div className="p-4 border-t border-gray-100 bg-gray-50/50">
        <div className="flex items-start gap-2.5 text-xs text-gray-500">
          <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p>
            <span className="font-medium text-gray-700">Pro tip:</span> Type{' '}
            <kbd className="px-1.5 py-0.5 bg-white rounded border border-gray-200 text-[10px] font-mono mx-0.5">/</kbd>{' '}
            in the editor to quickly add fields
          </p>
        </div>
      </div>
    </div>
  )
}
