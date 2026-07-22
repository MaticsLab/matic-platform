'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Lock, Eye as EyeIcon, Ticket, BookOpen,
  ChevronDown, GripVertical, Trash2, Settings, Pin, CreditCard, Calendar,
  Clock, MessageSquare, FileText, CheckCircle2, MoreVertical, Plus, Check
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui-components/button'
import { Switch } from '@/ui-components/switch'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { Textarea } from '@/ui-components/textarea'
import { ScrollArea } from '@/ui-components/scroll-area'
import { Separator } from '@/ui-components/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui-components/dropdown-menu'
import { Section } from '@/types/portal'
import { getCollaborationActions } from '@/lib/collaboration/collaboration-store'
import { MentionInput } from './MentionInput'
import { UpgradeModal } from './UpgradeModal'

interface UnifiedSidebarProps {
  sections: Section[]
  activeSectionId: string
  activeSpecialPage: 'signup' | 'review' | null
  onSelectSection: (id: string) => void
  onSelectSpecialPage: (page: 'signup' | 'review' | null) => void
  onReorderSections: (sections: Section[]) => void
  onDeleteSection: (id: string) => void
  onAddSection: (type: string) => void
  onUpdateSection?: (sectionId: string, updates: Partial<Section>) => void
}

// Section type variants for styling (used by both the sidebar list rows and,
// via inline hex below, the Add a page menu chips)
const SECTION_VARIANTS = {
  form: {
    label: 'Form',
    icon: Ticket,
    bg: 'bg-amber-50',
    fg: 'text-amber-600',
    activeBg: 'bg-amber-100',
    border: 'border-amber-200'
  },
  cover: {
    label: 'Cover',
    icon: BookOpen,
    bg: 'bg-blue-50',
    fg: 'text-blue-600',
    activeBg: 'bg-blue-100',
    border: 'border-blue-200'
  },
  ending: {
    label: 'Ending',
    icon: CheckCircle2,
    bg: 'bg-red-50',
    fg: 'text-red-700',
    activeBg: 'bg-red-100',
    border: 'border-red-200'
  },
  review: {
    label: 'Review',
    icon: EyeIcon,
    bg: 'bg-purple-50',
    fg: 'text-purple-600',
    activeBg: 'bg-purple-100',
    border: 'border-purple-200'
  },
} as const

// "Add a page" menu contents — copy, grouping, and colors per the page-type menu spec
const BASICS_ITEMS = [
  {
    type: 'form' as const,
    title: 'Form',
    description: 'Collect answers with questions and fields',
    icon: Ticket,
    bg: '#FAEEDA',
    fg: '#854F0B',
  },
  {
    type: 'cover' as const,
    title: 'Cover',
    description: 'Introduce your form or share instructions',
    icon: BookOpen,
    bg: '#E6F1FB',
    fg: '#185FA5',
  },
  {
    type: 'ending' as const,
    title: 'Ending',
    description: 'Thank users or send them to another link',
    icon: CheckCircle2,
    bg: '#FCEBEB',
    fg: '#A32D2D',
  },
]

const ADVANCED_ITEMS = [
  {
    type: 'review' as const,
    title: 'Review',
    description: 'Let users check their answers before submitting',
    icon: EyeIcon,
    bg: '#EEEDFE',
    fg: '#534AB7',
  },
  {
    type: 'signin' as const,
    title: 'Sign in',
    description: 'Let users sign in to save and resume their progress',
    icon: Lock,
    bg: '#E1F5EE',
    fg: '#0F6E56',
  },
  {
    type: 'payment' as const,
    title: 'Payment',
    description: 'Collect payments with Stripe',
    icon: CreditCard,
    bg: '#FBEAF0',
    fg: '#993556',
    premium: true,
    premiumCopy: 'Collect application fees or deposits directly through your form. Available on Pro.',
  },
  {
    type: 'scheduling' as const,
    title: 'Scheduling',
    description: 'Let users book a time on your calendar',
    icon: Calendar,
    bg: '#f8fafc',
    fg: '#475569',
    bordered: true,
    premium: true,
    premiumCopy: 'Let applicants book interview slots directly on your calendar. Available on Pro.',
  },
]

export function UnifiedSidebar({
  sections,
  activeSectionId,
  activeSpecialPage,
  onSelectSection,
  onSelectSpecialPage,
  onReorderSections,
  onDeleteSection,
  onAddSection,
  onUpdateSection,
}: UnifiedSidebarProps) {
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [upgradeModalItem, setUpgradeModalItem] = useState<{ title: string; premiumCopy: string } | null>(null)
  const [addMenuOpen, setAddMenuOpen] = useState(false)

  // Update collaboration awareness when active section changes
  useEffect(() => {
    const { updateCurrentSection } = getCollaborationActions()
    if (activeSectionId) {
      const activeSection = sections.find(s => s.id === activeSectionId)
      updateCurrentSection(activeSectionId, activeSection?.title || 'Untitled Section')
    } else if (activeSpecialPage) {
      // Track special pages too
      const pageNames = {
        signup: 'Sign in',
        review: 'Review and submit'
      }
      updateCurrentSection(`special-${activeSpecialPage}`, pageNames[activeSpecialPage])
    }
  }, [activeSectionId, activeSpecialPage, sections])

  const signinSection = Array.isArray(sections) ? sections.find(s => s.sectionType === 'signin') : undefined
  const hasSignin = !!signinSection
  const endingSection = Array.isArray(sections) ? sections.find(s => s.sectionType === 'ending') : undefined
  const hasEnding = !!endingSection

  // Separate sections by type - covers and forms render as regular draggable list items.
  // Sign in is rendered separately (pinned first); Review and Submit and Ending are
  // fixed, non-draggable pages pinned last (see below).
  const applicationSections = Array.isArray(sections)
    ? sections.filter(s => s.sectionType === 'form' || s.sectionType === 'cover' || !s.sectionType)
    : []

  // Drag handlers for form sections - use section ID to track dragged item
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null)

  const handleDragStart = (e: React.DragEvent, sectionId: string) => {
    setDraggedSectionId(sectionId)
    e.dataTransfer.effectAllowed = 'move'
    // Add data for compatibility
    e.dataTransfer.setData('text/plain', sectionId)
  }

  const handleDragOver = (e: React.DragEvent, targetSectionId: string) => {
    e.preventDefault()
    if (!draggedSectionId || draggedSectionId === targetSectionId) return

    // Find actual indices in the full sections array
    const draggedIndex = sections.findIndex(s => s.id === draggedSectionId)
    const targetIndex = sections.findIndex(s => s.id === targetSectionId)

    if (draggedIndex === -1 || targetIndex === -1) return

    const newSections = [...sections]
    const [draggedSection] = newSections.splice(draggedIndex, 1)
    newSections.splice(targetIndex, 0, draggedSection)

    onReorderSections(newSections)
  }

  const handleDragEnd = () => {
    setDraggedSectionId(null)
  }

  const handleStartEditing = (section: Section, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingSectionId(section.id)
    setEditingTitle(section.title || '')
  }

  const handleFinishEditing = () => {
    if (editingSectionId && onUpdateSection) {
      const trimmedTitle = editingTitle.trim()
      if (trimmedTitle) {
        onUpdateSection(editingSectionId, { title: trimmedTitle })
      }
    }
    setEditingSectionId(null)
    setEditingTitle('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleFinishEditing()
    } else if (e.key === 'Escape') {
      setEditingSectionId(null)
      setEditingTitle('')
    }
  }

  const renderSectionItem = (section: Section, isDraggable = true) => {
    const type = (section.sectionType || 'form') as keyof typeof SECTION_VARIANTS
    const variant = SECTION_VARIANTS[type] || SECTION_VARIANTS.form
    const Icon = variant.icon
    const isActive = activeSectionId === section.id && !activeSpecialPage
    const isDragging = draggedSectionId === section.id
    const isEditing = editingSectionId === section.id

    return (
      <motion.div
        key={section.id}
        layout
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -10 }}
        draggable={isDraggable && !isEditing}
        onDragStart={isDraggable && !isEditing ? (e) => handleDragStart(e as any, section.id) : undefined}
        onDragOver={isDraggable ? (e) => handleDragOver(e as any, section.id) : undefined}
        onDragEnd={isDraggable ? handleDragEnd : undefined}
        onClick={() => {
          if (!isEditing) {
            onSelectSection(section.id)
            onSelectSpecialPage(null)
          }
        }}
        className={cn(
          "group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-all w-full max-w-full",
          isActive
            ? cn("shadow-sm border", variant.activeBg, variant.border)
            : "hover:bg-gray-50",
          isDragging && "opacity-50 ring-2 ring-blue-400"
        )}
      >
        {isDraggable && (
          <div className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing flex-shrink-0">
            <GripVertical className="w-3.5 h-3.5 text-gray-400" />
          </div>
        )}
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0", variant.bg)}>
          <Icon className={cn("w-3.5 h-3.5", variant.fg)} />
        </div>
        {isEditing ? (
          <Input
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            onBlur={handleFinishEditing}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            className="flex-1 h-6 text-sm font-medium py-0 px-1 min-w-0"
            placeholder={variant.label}
          />
        ) : (
          <span
            className={cn("flex-1 text-sm font-medium truncate min-w-0", isActive ? "text-gray-900" : "text-gray-700")}
            onDoubleClick={(e) => handleStartEditing(section, e)}
            title="Double-click to edit"
          >
            {section.title || variant.label}
          </span>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 flex-shrink-0">
              <MoreVertical className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-red-600"
              onClick={(e) => {
                e.stopPropagation()
                onDeleteSection(section.id)
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </motion.div>
    )
  }

  const handleMenuItemClick = (item: typeof ADVANCED_ITEMS[number] | typeof BASICS_ITEMS[number], isAdded: boolean) => {
    if ('premium' in item && item.premium) {
      setUpgradeModalItem({ title: item.title, premiumCopy: (item as any).premiumCopy })
      return
    }
    if (isAdded) return
    onAddSection(item.type)
    setAddMenuOpen(false)
  }

  const renderMenuRow = (item: typeof ADVANCED_ITEMS[number] | typeof BASICS_ITEMS[number]) => {
    const isPremium = 'premium' in item && !!item.premium
    const isAdded = !isPremium && (
      item.type === 'review' ? true :
      item.type === 'ending' ? hasEnding :
      item.type === 'signin' ? hasSignin :
      false
    )
    const Icon = item.icon
    const bordered = 'bordered' in item && item.bordered

    return (
      <button
        key={item.type}
        onClick={() => handleMenuItemClick(item, isAdded)}
        disabled={isAdded}
        className={cn(
          "w-full flex items-start gap-3 p-2.5 rounded-lg transition-colors text-left",
          isAdded ? "cursor-default opacity-60" : "hover:bg-gray-50 cursor-pointer"
        )}
      >
        <div
          className="w-9 h-9 shrink-0 rounded-[9px] flex items-center justify-center"
          style={{ background: item.bg, border: bordered ? '1px solid #e2e8f0' : undefined }}
        >
          <Icon className="w-[18px] h-[18px]" style={{ color: item.fg }} />
        </div>
        <div className="flex-1 pt-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-gray-900">{item.title}</span>
            {isPremium && (
              <span
                className="text-[11px] font-semibold rounded-md px-2 py-0.5"
                style={{ color: '#534AB7', background: '#EEEDFE' }}
              >
                Premium
              </span>
            )}
            {isAdded && (
              <span
                className="text-[11px] font-semibold rounded-md px-2 py-0.5 flex items-center gap-1"
                style={{ color: '#0F6E56', background: '#E1F5EE' }}
              >
                <Check className="w-3 h-3" /> Added
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">{item.description}</div>
        </div>
      </button>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white overflow-y-auto overflow-x-hidden min-h-0 w-full">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
        <h3 className="text-sm font-semibold text-gray-900">Pages</h3>
        <DropdownMenu open={addMenuOpen} onOpenChange={setAddMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1">
              <Plus className="w-3.5 h-3.5" />
              <span className="text-xs">Add</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[420px] p-3">
            <div className="px-1 pb-2">
              <h4 className="text-base font-semibold text-gray-900">Add a page</h4>
            </div>
            <div className="px-1.5 pb-1.5 text-[11px] font-semibold tracking-[0.06em] text-gray-400 uppercase">
              Basics
            </div>
            <div className="space-y-0.5">
              {BASICS_ITEMS.map(renderMenuRow)}
            </div>
            <Separator className="my-2" />
            <div className="px-1.5 pb-1.5 text-[11px] font-semibold tracking-[0.06em] text-gray-400 uppercase">
              Advanced
            </div>
            <div className="space-y-0.5">
              {ADVANCED_ITEMS.map(renderMenuRow)}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ScrollArea className="flex-1 min-h-0 w-full">
        <div className="p-2 space-y-1 w-full">
          {/* ═══════════════════════════════════════════════════════════════════
              SIGN IN — optional, pinned first when present
          ═══════════════════════════════════════════════════════════════════ */}
          {hasSignin && signinSection && (
            <>
              <div
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border"
                style={{ background: '#E1F5EE', borderColor: '#5DCAA5' }}
              >
                <button
                  onClick={() => {
                    onSelectSpecialPage('signup')
                    onSelectSection('')
                  }}
                  className="flex-1 flex items-center gap-2.5 min-w-0 text-left"
                >
                  <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
                    <Lock className="w-3.5 h-3.5" style={{ color: '#0F6E56' }} />
                  </div>
                  <span className="flex-1 text-sm font-medium truncate" style={{ color: '#085041' }}>
                    {signinSection.title || 'Sign in'}
                  </span>
                </button>
                <Pin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#0F6E56' }} />
                <button
                  onClick={() => onDeleteSection(signinSection.id)}
                  className="p-1 rounded hover:bg-white/60 flex-shrink-0"
                  title="Remove sign-in page"
                >
                  <Trash2 className="w-3.5 h-3.5" style={{ color: '#0F6E56' }} />
                </button>
              </div>
              <p className="text-xs text-gray-400 px-1 pb-1 leading-relaxed">
                Sign-in always appears first so users can save their progress.
              </p>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              APPLICATION FORM SECTIONS (covers and forms — freely draggable)
          ═══════════════════════════════════════════════════════════════════ */}
          <div className="space-y-1">
            <AnimatePresence mode="popLayout">
              {applicationSections.map((section) => renderSectionItem(section, true))}
            </AnimatePresence>

            {/* Review and submit — fixed final step, not draggable */}
            <button
              onClick={() => {
                onSelectSpecialPage('review')
                onSelectSection('')
              }}
              className={cn(
                "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors text-left",
                activeSpecialPage === 'review'
                  ? "bg-purple-50 text-purple-900 border border-purple-200"
                  : "text-gray-700 hover:bg-gray-50"
              )}
            >
              <Lock className="w-3 h-3 text-gray-300 flex-shrink-0" />
              <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                <EyeIcon className="w-3.5 h-3.5 text-purple-600" />
              </div>
              <span className="font-medium flex-1 truncate">Review and submit</span>
              <span className="text-[11px] text-gray-400 bg-gray-50 border border-gray-200 rounded-md px-2 py-0.5 flex-shrink-0">
                Final step
              </span>
            </button>

            {/* Ending — optional, pinned last, not draggable */}
            {hasEnding && endingSection && (
              <div
                className={cn(
                  "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors group",
                  activeSectionId === endingSection.id && !activeSpecialPage
                    ? "bg-red-50 text-red-900 border border-red-200"
                    : "text-gray-700 hover:bg-gray-50"
                )}
              >
                <button
                  onClick={() => {
                    onSelectSection(endingSection.id)
                    onSelectSpecialPage(null)
                  }}
                  className="flex-1 flex items-center gap-2 min-w-0 text-left"
                >
                  <Lock className="w-3 h-3 text-gray-300 flex-shrink-0" />
                  <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-red-700" />
                  </div>
                  <span className="font-medium flex-1 truncate">{endingSection.title || 'Ending'}</span>
                </button>
                <span className="text-[11px] text-gray-400 bg-gray-50 border border-gray-200 rounded-md px-2 py-0.5 flex-shrink-0">
                  After submit
                </span>
                <button
                  onClick={() => onDeleteSection(endingSection.id)}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-100 flex-shrink-0"
                  title="Remove ending page"
                >
                  <Trash2 className="w-3.5 h-3.5 text-gray-400" />
                </button>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {upgradeModalItem && (
        <UpgradeModal
          open={!!upgradeModalItem}
          onOpenChange={(open) => !open && setUpgradeModalItem(null)}
          title={`${upgradeModalItem.title} is a Pro feature`}
          description={upgradeModalItem.premiumCopy}
        />
      )}
    </div>
  )
}
