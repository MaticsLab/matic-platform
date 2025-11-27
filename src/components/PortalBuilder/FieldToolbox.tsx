import { 
  Type, AlignLeft, Hash, Mail, Calendar, CheckSquare, List, Image as ImageIcon,
  Phone, Link, Clock, PenTool, Star, Minus, Heading, Pilcrow, CheckCircle2, Layout, Search, ArrowUpDown
} from 'lucide-react'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Field, FieldType } from '@/types/portal'

const FIELD_GROUPS = [
  {
    title: 'Basic Fields',
    items: [
      { type: 'text', label: 'Text Input', icon: Type },
      { type: 'textarea', label: 'Text Area', icon: AlignLeft },
      { type: 'number', label: 'Number', icon: Hash },
      { type: 'email', label: 'Email', icon: Mail },
      { type: 'phone', label: 'Phone', icon: Phone },
      { type: 'url', label: 'URL', icon: Link },
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
      { type: 'datetime', label: 'Date & Time', icon: Calendar },
      { type: 'time', label: 'Time', icon: Clock },
    ]
  },
  {
    title: 'Media & Advanced',
    items: [
      { type: 'file', label: 'File Upload', icon: ImageIcon },
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
  return (
    <div className="flex-1 flex flex-col bg-gray-50/50 min-h-0">
      <div className="p-4 pb-2">
         <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input placeholder="Search fields" className="pl-9 bg-white border-gray-200" />
         </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {FIELD_GROUPS.map((group, idx) => (
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
      </div>
    </div>
  )
}
