/**
 * Ending Blocks Toolbox
 * Displays draggable blocks for ending pages (shown when ending section is selected)
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Heading, Type, Image as ImageIcon, Sparkles, Minus, 
  MessageSquare, Circle, Square, LucideIcon, Box
} from 'lucide-react'
import { Input } from '@/ui-components/input'
import { cn } from '@/lib/utils'
import { ENDING_BLOCK_REGISTRY } from '@/lib/ending-block-registry'

interface BlockItem {
  type: string
  label: string
  icon: LucideIcon
  description: string
  color: string
}

const iconMap: Record<string, LucideIcon> = {
  circle: Circle,
  heading: Heading,
  type: Type,
  'square-stack': Square,
  image: ImageIcon,
  minus: Minus,
  sparkles: Sparkles,
  'message-square': MessageSquare,
  box: Box
}

const colorClasses: Record<string, { bg: string; bgHover: string; text: string; border: string }> = {
  blue: { bg: 'bg-blue-50', bgHover: 'hover:bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' },
  emerald: { bg: 'bg-emerald-50', bgHover: 'hover:bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-200' },
  purple: { bg: 'bg-purple-50', bgHover: 'hover:bg-purple-100', text: 'text-purple-600', border: 'border-purple-200' },
  amber: { bg: 'bg-amber-50', bgHover: 'hover:bg-amber-100', text: 'text-amber-600', border: 'border-amber-200' },
  rose: { bg: 'bg-rose-50', bgHover: 'hover:bg-rose-100', text: 'text-rose-600', border: 'border-rose-200' },
  cyan: { bg: 'bg-cyan-50', bgHover: 'hover:bg-cyan-100', text: 'text-cyan-600', border: 'border-cyan-200' },
  gray: { bg: 'bg-gray-50', bgHover: 'hover:bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' }
}

interface EndingBlocksToolboxProps {
  onAddBlock: (blockType: string) => void
}

export function EndingBlocksToolbox({ onAddBlock }: EndingBlocksToolboxProps) {
  const [searchQuery, setSearchQuery] = useState('')

  // Convert registry to block items
  const blockItems: BlockItem[] = Object.entries(ENDING_BLOCK_REGISTRY).map(([type, def]) => {
    const IconComponent = iconMap[def.icon || 'box'] || Box
    
    // Assign colors based on category
    let color = 'blue'
    if (def.category === 'interactive') color = 'emerald'
    else if (def.category === 'layout') color = 'gray'
    
    return {
      type,
      label: def.label,
      icon: IconComponent,
      description: def.description || '',
      color
    }
  })

  const filteredBlocks = searchQuery
    ? blockItems.filter(block => 
        block.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        block.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : blockItems

  // Group blocks by category
  const contentBlocks = filteredBlocks.filter(b => 
    ['icon', 'heading', 'paragraph', 'image', 'callout', 'footer-message'].includes(b.type)
  )
  const interactiveBlocks = filteredBlocks.filter(b => 
    ['button', 'button-group'].includes(b.type)
  )
  const layoutBlocks = filteredBlocks.filter(b => 
    ['spacer', 'divider'].includes(b.type)
  )

  const renderBlockGroup = (title: string, blocks: BlockItem[]) => {
    if (blocks.length === 0) return null

    return (
      <div className="mb-4">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 mb-2">
          {title}
        </h4>
        <div className="space-y-1 px-2">
          {blocks.map((block) => {
            const colors = colorClasses[block.color] || colorClasses.blue
            const IconComponent = block.icon

            return (
              <motion.button
                key={block.type}
                onClick={() => onAddBlock(block.type)}
                className={cn(
                  "w-full flex items-start gap-3 p-2.5 rounded-lg border transition-all text-left group",
                  colors.bg,
                  colors.bgHover,
                  colors.border,
                  "hover:shadow-sm"
                )}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md flex-shrink-0",
                  colors.bg,
                  colors.text
                )}>
                  <IconComponent className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 group-hover:text-gray-900">
                    {block.label}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                    {block.description}
                  </p>
                </div>
              </motion.button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Ending Blocks</h3>
        <Input
          type="text"
          placeholder="Search blocks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full text-sm"
        />
      </div>

      {/* Blocks List */}
      <div className="flex-1 overflow-y-auto py-3">
        {filteredBlocks.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-gray-500">No blocks found</p>
          </div>
        ) : (
          <>
            {renderBlockGroup('Content', contentBlocks)}
            {renderBlockGroup('Interactive', interactiveBlocks)}
            {renderBlockGroup('Layout', layoutBlocks)}
          </>
        )}
      </div>

      {/* Info Footer */}
      <div className="px-4 py-3 border-t border-gray-200 bg-blue-50">
        <p className="text-xs text-blue-700">
          💡 Click a block to add it to your ending page
        </p>
      </div>
    </div>
  )
}
