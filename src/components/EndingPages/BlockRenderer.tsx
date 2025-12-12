/**
 * Block Renderer - Universal renderer for ending page blocks
 * Used in both editor preview and public portal
 */

'use client'

import React, { useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
  Star,
  Heart,
  Flag,
  Zap,
  ChevronRight
} from 'lucide-react'
import { Button } from '@/ui-components/button'
import { EndingBlock } from '@/types/ending-blocks'
import DOMPurify from 'dompurify'

const ICON_MAP: Record<string, React.ReactNode> = {
  'check-circle': <CheckCircle2 className="w-full h-full" />,
  'x-circle': <XCircle className="w-full h-full" />,
  'alert-circle': <AlertCircle className="w-full h-full" />,
  'info': <Info className="w-full h-full" />,
  'star': <Star className="w-full h-full" />,
  'heart': <Heart className="w-full h-full" />,
  'flag': <Flag className="w-full h-full" />,
  'zap': <Zap className="w-full h-full" />
}

const ICON_SIZES = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24'
}

interface BlockRendererProps {
  block: EndingBlock
  submissionData?: Record<string, any>
  onButtonClick?: (action: string, url?: string) => void
}

export function BlockRenderer({ block, submissionData, onButtonClick }: BlockRendererProps) {
  // Check if block should render based on conditions
  const shouldRender = useMemo(() => {
    if (!block.conditions || block.conditions.length === 0) return true

    return block.conditions.every(condition => {
      const value = submissionData?.[condition.fieldId]

      switch (condition.operator) {
        case 'equals':
          return value === condition.value

        case 'notEquals':
          return value !== condition.value

        case 'contains':
          if (typeof value === 'string') {
            return value.includes(String(condition.value))
          }
          if (Array.isArray(value)) {
            return value.some(v => String(v).includes(String(condition.value)))
          }
          return false

        case 'isEmpty':
          return !value || value === '' || (Array.isArray(value) && value.length === 0)

        case 'isNotEmpty':
          return !!value && value !== '' && (!Array.isArray(value) || value.length > 0)

        default:
          return true
      }
    })
  }, [block.conditions, submissionData])

  if (!shouldRender || block.metadata.hidden) {
    return null
  }

  const { blockType, props } = block

  const spacing = block.styles ? {
    marginTop: block.styles.marginTop ? `${block.styles.marginTop}px` : undefined,
    marginBottom: block.styles.marginBottom ? `${block.styles.marginBottom}px` : undefined,
    marginLeft: block.styles.marginLeft ? `${block.styles.marginLeft}px` : undefined,
    marginRight: block.styles.marginRight ? `${block.styles.marginRight}px` : undefined,
    paddingTop: block.styles.paddingTop ? `${block.styles.paddingTop}px` : undefined,
    paddingBottom: block.styles.paddingBottom ? `${block.styles.paddingBottom}px` : undefined
  } : {}

  const containerClass = cn(block.styles?.customClass)

  switch (blockType) {
    case 'icon': {
      const sizeClass = ICON_SIZES[props.size as keyof typeof ICON_SIZES] || ICON_SIZES.lg
      return (
        <div
          className="flex justify-center mb-6"
          style={spacing}
        >
          <div
            className={cn(sizeClass)}
            style={{ color: props.color }}
          >
            {ICON_MAP[props.name] || ICON_MAP['check-circle']}
          </div>
        </div>
      )
    }

    case 'heading': {
      const HeadingTag = `h${props.level}` as keyof JSX.IntrinsicElements
      const sizeMap = {
        1: 'text-4xl',
        2: 'text-3xl',
        3: 'text-2xl',
        4: 'text-xl'
      }
      return React.createElement(
        HeadingTag,
        {
          className: cn(
            'font-bold mb-4',
            sizeMap[props.level as keyof typeof sizeMap] || sizeMap[1],
            props.align === 'center' && 'text-center',
            props.align === 'right' && 'text-right',
            containerClass
          ),
          style: spacing
        },
        props.text
      )
    }

    case 'paragraph': {
      const sizeMap = {
        sm: 'text-sm',
        base: 'text-base',
        lg: 'text-lg'
      }
      return (
        <p
          className={cn(
            'mb-4 leading-relaxed text-gray-600',
            sizeMap[props.size as keyof typeof sizeMap] || sizeMap.base,
            props.align === 'center' && 'text-center',
            props.align === 'right' && 'text-right',
            containerClass
          )}
          style={spacing}
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(props.text)
          }}
        />
      )
    }

    case 'button': {
      const variantMap: Record<string, any> = {
        primary: 'bg-blue-600 text-white hover:bg-blue-700',
        secondary: 'bg-gray-600 text-white hover:bg-gray-700',
        outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50',
        ghost: 'text-blue-600 hover:bg-blue-50'
      }

      return (
        <div
          className={cn('mb-3 flex justify-center', props.fullWidth && 'w-full')}
          style={spacing}
        >
          <button
            onClick={() => onButtonClick?.(props.action, props.url)}
            className={cn(
              'px-6 py-2 rounded-lg font-medium transition-colors',
              variantMap[props.variant] || variantMap.primary,
              props.fullWidth && 'w-full'
            )}
          >
            {props.text}
          </button>
        </div>
      )
    }

    case 'divider':
      {
        const spacingClass = props.spacing === 'sm'
          ? 'my-4'
          : props.spacing === 'lg'
            ? 'my-8'
            : 'my-6'
        return (
          <div
            className={cn(spacingClass)}
            style={spacing}
          >
            <div
              className="h-px w-full"
              style={{ backgroundColor: props.color || '#e5e7eb' }}
            />
          </div>
        )
      }

    case 'image':
      return (
        <div
          className={cn(
            'mb-6',
            props.align === 'center' && 'flex justify-center',
            props.align === 'right' && 'flex justify-end'
          )}
          style={spacing}
        >
          <img
            src={props.url}
            alt={props.alt || 'Image'}
            width={props.width}
            className="rounded-lg"
          />
        </div>
      )

    case 'callout': {
      const typeMap = {
        info: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900' },
        success: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-900' },
        warning: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-900' },
        error: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-900' }
      }
      const style = typeMap[props.type as keyof typeof typeMap] || typeMap.info

      return (
        <div
          className={cn('p-4 rounded-lg border mb-6', style.bg, style.border, style.text)}
          style={spacing}
        >
          {props.title && <h4 className="font-semibold mb-2">{props.title}</h4>}
          <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(props.text) }} />
        </div>
      )
    }

    case 'footer-message':
      return (
        <p
          className="text-xs text-gray-500 text-center italic mt-6"
          style={spacing}
        >
          {props.icon && '✓ '}
          {props.text}
        </p>
      )

    case 'spacer':
      return (
        <div
          style={{
            height: `${props.height}px`,
            ...spacing
          }}
        />
      )

    default:
      return null
  }
}

interface EndingPageRendererProps {
  config: {
    blocks: EndingBlock[]
    settings: {
      layout: string
      maxWidth: number
      padding: { top: number; right: number; bottom: number; left: number }
      backgroundColor: string
    }
    theme: {
      colorPrimary: string
      colorText: string
    }
  }
  submissionData?: Record<string, any>
  onButtonClick?: (action: string, url?: string) => void
}

export function EndingPageRenderer({
  config,
  submissionData,
  onButtonClick
}: EndingPageRendererProps) {
  const sortedBlocks = [...config.blocks].sort((a, b) => a.metadata.order - b.metadata.order)

  return (
    <div
      style={{
        maxWidth: `${config.settings.maxWidth}px`,
        padding: `${config.settings.padding.top}px ${config.settings.padding.right}px ${config.settings.padding.bottom}px ${config.settings.padding.left}px`,
        backgroundColor: config.settings.backgroundColor,
        margin: '0 auto'
      }}
    >
      {sortedBlocks.map(block => (
        <BlockRenderer
          key={block.id}
          block={block}
          submissionData={submissionData}
          onButtonClick={onButtonClick}
        />
      ))}
    </div>
  )
}
