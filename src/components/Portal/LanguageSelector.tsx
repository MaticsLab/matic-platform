'use client'

/**
 * LanguageSelector Component
 * 
 * A reusable language selector that integrates with the TranslationProvider.
 * Can be used in any portal component where language switching is needed.
 */

import { Languages, Globe, Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui-components/select'
import { Button } from '@/ui-components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui-components/dropdown-menu'
import { useTranslationContext } from '@/lib/i18n/TranslationProvider'
import { getLanguageName, isRTL as checkIsRTL } from '@/lib/languages'

interface LanguageSelectorProps {
  /** Visual variant */
  variant?: 'select' | 'dropdown' | 'minimal'
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Additional class names */
  className?: string
  /** Whether to show the language name or just code */
  showName?: boolean
  /** Whether to show the globe/language icon */
  showIcon?: boolean
  /** Position when using floating style */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  /** Whether to use floating fixed positioning */
  floating?: boolean
}

export function LanguageSelector({
  variant = 'select',
  size = 'md',
  className,
  showName = true,
  showIcon = true,
  position = 'top-right',
  floating = false
}: LanguageSelectorProps) {
  const context = useTranslationContext()
  
  // Don't render if translations are not enabled or only one language
  if (!context.isEnabled || context.supportedLanguages.length <= 1) {
    return null
  }
  
  const { activeLanguage, supportedLanguages, setLanguage, isRTL } = context
  
  const sizeClasses = {
    sm: 'h-8 text-xs',
    md: 'h-9 text-sm',
    lg: 'h-10 text-base'
  }
  
  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4'
  }
  
  const wrapperClasses = cn(
    floating && 'fixed z-50',
    floating && positionClasses[position],
    className
  )
  
  const displayLanguage = (code: string) => {
    if (showName) {
      return getLanguageName(code)
    }
    return code.toUpperCase()
  }
  
  // Select variant (default)
  if (variant === 'select') {
    return (
      <div className={wrapperClasses}>
        <Select value={activeLanguage} onValueChange={setLanguage}>
          <SelectTrigger 
            className={cn(
              'bg-white/90 backdrop-blur-sm border-gray-200',
              showName ? 'w-36' : 'w-20',
              sizeClasses[size]
            )}
          >
            {showIcon && <Languages className="w-4 h-4 mr-2 flex-shrink-0" />}
            <SelectValue>
              {displayLanguage(activeLanguage)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent align={isRTL ? 'start' : 'end'}>
            {supportedLanguages.map(lang => (
              <SelectItem key={lang} value={lang}>
                <span className="flex items-center gap-2">
                  {displayLanguage(lang)}
                  {checkIsRTL(lang) && (
                    <span className="text-xs text-gray-400">(RTL)</span>
                  )}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }
  
  // Dropdown variant
  if (variant === 'dropdown') {
    return (
      <div className={wrapperClasses}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              className={cn(
                'bg-white/90 backdrop-blur-sm',
                sizeClasses[size]
              )}
            >
              {showIcon && <Globe className="w-4 h-4 mr-2" />}
              {displayLanguage(activeLanguage)}
              <ChevronDown className="w-4 h-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
            {supportedLanguages.map(lang => (
              <DropdownMenuItem
                key={lang}
                onClick={() => setLanguage(lang)}
                className={cn(
                  'flex items-center justify-between',
                  lang === activeLanguage && 'bg-gray-100'
                )}
              >
                <span className="flex items-center gap-2">
                  {displayLanguage(lang)}
                  {checkIsRTL(lang) && (
                    <span className="text-xs text-gray-400">(RTL)</span>
                  )}
                </span>
                {lang === activeLanguage && (
                  <Check className="w-4 h-4 text-green-600" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }
  
  // Minimal variant (just text buttons)
  return (
    <div className={cn('flex items-center gap-1', wrapperClasses)}>
      {supportedLanguages.map((lang, idx) => (
        <span key={lang} className="flex items-center">
          {idx > 0 && <span className="text-gray-300 mx-1">|</span>}
          <button
            onClick={() => setLanguage(lang)}
            className={cn(
              'px-2 py-1 rounded transition-colors',
              sizeClasses[size],
              lang === activeLanguage
                ? 'font-medium text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {showName ? displayLanguage(lang) : lang.toUpperCase()}
          </button>
        </span>
      ))}
    </div>
  )
}

/**
 * Standalone language selector that doesn't require TranslationProvider
 * Use this when you need language selection outside of the provider context
 */
interface StandaloneLanguageSelectorProps {
  activeLanguage: string
  supportedLanguages: string[]
  onLanguageChange: (lang: string) => void
  className?: string
  showIcon?: boolean
}

export function StandaloneLanguageSelector({
  activeLanguage,
  supportedLanguages,
  onLanguageChange,
  className,
  showIcon = true
}: StandaloneLanguageSelectorProps) {
  if (supportedLanguages.length <= 1) {
    return null
  }
  
  return (
    <div className={className}>
      <Select value={activeLanguage} onValueChange={onLanguageChange}>
        <SelectTrigger className="w-32 h-9 text-sm bg-white/90 backdrop-blur-sm">
          {showIcon && <Languages className="w-4 h-4 mr-2" />}
          <SelectValue>{activeLanguage.toUpperCase()}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {supportedLanguages.map(lang => (
            <SelectItem key={lang} value={lang}>
              {getLanguageName(lang)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
