import { useState, useEffect, useMemo } from 'react'
import { 
  Type, AlignLeft, Hash, Mail, Calendar, CheckSquare, List, Image as ImageIcon,
  Phone, Link, Clock, PenTool, Star, Minus, Heading, Pilcrow, CheckCircle2, Layout, Search, ArrowUpDown,
  FileUp, CalendarClock, FunctionSquare, Calculator, Link2, Box, Loader2, LucideIcon, MapPin
} from 'lucide-react'
import { Input } from '@/ui-components/input'
import { FieldType } from '@/types/portal'
import { fieldTypesClient, FieldTypesToolbox, FieldTypeSummary } from '@/lib/api/field-types-client'

// Type for field group items
interface FieldGroupItem {
  type: string
  label: string
  icon: LucideIcon
  description?: string
}

interface FieldGroup {
  title: string
  items: FieldGroupItem[]
}

// Icon mapping from string names to Lucide components
const ICON_MAP: Record<string, LucideIcon> = {
  Type, AlignLeft, Hash, Mail, Calendar, CheckSquare, List, Image: ImageIcon,
  Phone, Link, Clock, PenTool, Star, Minus, Heading, Pilcrow, CheckCircle2, Layout, Search, ArrowUpDown,
  FileUp, CalendarClock, FunctionSquare, Calculator, Link2, Box, Text: Pilcrow, Folder: Layout,
  ListChecks: List, ChevronDown: List, Circle: CheckCircle2, LayoutGrid: Layout, MapPin
}

// Fallback icons by field type ID (when icon column is empty in database)
const FIELD_TYPE_ID_ICONS: Record<string, LucideIcon> = {
  text: Type,
  textarea: AlignLeft,
  number: Hash,
  email: Mail,
  phone: Phone,
  url: Link,
  address: MapPin,
  select: List,
  multiselect: List,
  radio: CheckCircle2,
  checkbox: CheckSquare,
  date: Calendar,
  datetime: CalendarClock,
  time: Clock,
  file: FileUp,
  image: ImageIcon,
  signature: PenTool,
  rating: Star,
  rank: ArrowUpDown,
  divider: Minus,
  heading: Heading,
  paragraph: Pilcrow,
  group: Layout,
  repeater: List,
  section: Layout,
}

function getIconComponent(iconName?: string, fieldTypeId?: string): LucideIcon {
  // Try icon name first
  if (iconName && ICON_MAP[iconName]) {
    return ICON_MAP[iconName]
  }
  // Fall back to field type ID mapping
  if (fieldTypeId && FIELD_TYPE_ID_ICONS[fieldTypeId]) {
    return FIELD_TYPE_ID_ICONS[fieldTypeId]
  }
  return Box
}

// Fallback static field groups (used if API fails)
const STATIC_FIELD_GROUPS: FieldGroup[] = [
  {
    title: 'Basic Fields',
    items: [
      { type: 'text', label: 'Text Input', icon: Type },
      { type: 'textarea', label: 'Text Area', icon: AlignLeft },
      { type: 'number', label: 'Number', icon: Hash },
      { type: 'email', label: 'Email', icon: Mail },
      { type: 'phone', label: 'Phone', icon: Phone },
      { type: 'url', label: 'URL', icon: Link },
      { type: 'address', label: 'Address', icon: MapPin, description: 'Address with autocomplete' },
    ]
  },
  {
    title: 'Selection',
    items: [
      { type: 'select', label: 'Dropdown', icon: List },
      { type: 'multiselect', label: 'Multi-Select', icon: List },
      { type: 'radio', label: 'Single Choice', icon: CheckCircle2 },
      { type: 'checkbox', label: 'Checkbox', icon: CheckSquare },
      { type: 'rank', label: 'Rank', icon: ArrowUpDown },
    ]
  },
  {
    title: 'Date & Time',
    items: [
      { type: 'date', label: 'Date', icon: Calendar },
      { type: 'datetime', label: 'Date & Time', icon: CalendarClock },
      { type: 'time', label: 'Time', icon: Clock },
    ]
  },
  {
    title: 'Media & Advanced',
    items: [
      { type: 'file', label: 'File Upload', icon: FileUp },
      { type: 'image', label: 'Image Upload', icon: ImageIcon },
      { type: 'signature', label: 'Signature', icon: PenTool },
      { type: 'rating', label: 'Rating', icon: Star },
    ]
  },
  {
    title: 'Layout',
    items: [
      { type: 'heading', label: 'Heading', icon: Heading },
      { type: 'paragraph', label: 'Paragraph', icon: Pilcrow },
      { type: 'divider', label: 'Divider', icon: Minus },
      { type: 'group', label: 'Group', icon: Layout },
      { type: 'repeater', label: 'Repeater', icon: List },
    ]
  }
]

interface FieldToolboxProps {
  onAddField: (type: FieldType) => void
}

export function FieldToolbox({ onAddField }: FieldToolboxProps) {
  const [toolbox, setToolbox] = useState<FieldTypesToolbox | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadFieldTypes = async () => {
      try {
        const data = await fieldTypesClient.getToolbox()
        setToolbox(data)
      } catch (error) {
        console.error('Failed to load field types from registry, using static fallback:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadFieldTypes()
  }, [])

  // Convert API response to display groups
  const fieldGroups: FieldGroup[] = useMemo(() => {
    if (!toolbox) return STATIC_FIELD_GROUPS

    const categoryLabels: Record<string, string> = {
      primitive: 'Basic Fields',
      container: 'Containers',
      layout: 'Layout',
      special: 'Advanced',
    }

    return Object.entries(toolbox)
      .filter(([_, items]) => items.length > 0)
      .map(([category, items]) => ({
        title: categoryLabels[category] || category,
        items: items.map((item: FieldTypeSummary) => ({
          type: item.id,
          label: item.label,
          icon: getIconComponent(item.icon, item.id),
          description: item.description,
        }))
      }))
  }, [toolbox])

  // Filter fields by search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return fieldGroups

    const query = searchQuery.toLowerCase()
    return fieldGroups
      .map(group => ({
        ...group,
        items: group.items.filter((item) => 
          item.label.toLowerCase().includes(query) ||
          item.type.toLowerCase().includes(query)
        )
      }))
      .filter(group => group.items.length > 0)
  }, [fieldGroups, searchQuery])

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50/50">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50/50 min-h-0">
      <div className="p-4 pb-2">
         <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Search fields" 
              className="pl-9 bg-white border-gray-200"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
         </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {filteredGroups.map((group, idx) => (
          <div key={idx} className="space-y-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">{group.title}</h4>
            <div className="grid grid-cols-2 gap-3">
              {group.items.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.type}
                    className="flex flex-col items-center justify-center gap-2 p-3 bg-white border border-gray-200 rounded-xl hover:border-blue-500 hover:shadow-sm transition-all text-center group cursor-pointer"
                    onClick={() => onAddField(item.type as FieldType)}
                    title={item.description}
                  >
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-100 transition-colors">
                        <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-medium text-gray-700">{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        {filteredGroups.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            No fields match your search
          </div>
        )}
      </div>
    </div>
  )
}
