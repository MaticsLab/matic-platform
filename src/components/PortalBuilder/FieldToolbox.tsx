import { 
  Type, AlignLeft, Hash, Mail, Calendar, CheckSquare, List, Image as ImageIcon,
  Phone, Link, Clock, PenTool, Star, Minus, Heading, Pilcrow, CheckCircle2, Layout
} from 'lucide-react'
import { Button } from '@/ui-components/button'
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
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Add Fields</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {FIELD_GROUPS.map((group, idx) => (
          <div key={idx} className="space-y-2">
            <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider px-1">{group.title}</h4>
            <div className="grid grid-cols-1 gap-2">
              {group.items.map((item) => {
                const Icon = item.icon
                return (
                  <Button
                    key={item.type}
                    variant="outline"
                    className="justify-start gap-3 bg-white hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all h-10"
                    onClick={() => onAddField(item.type as FieldType)}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
