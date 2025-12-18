'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Input } from '@/ui-components/input'
import { Textarea } from '@/ui-components/textarea'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/ui-components/popover'
import { cn } from '@/lib/utils'
import type { Field } from '@/types/portal'

interface MentionInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  availableFields?: Field[]
  multiline?: boolean
}

interface MentionOption {
  id: string
  label: string
  value: string
}

const DEFAULT_MENTIONS: MentionOption[] = [
  { id: 'firstName', label: 'First Name', value: '{{firstName}}' },
  { id: 'fullName', label: 'Full Name', value: '{{fullName}}' },
  { id: 'email', label: 'Email', value: '{{email}}' },
]

export function MentionInput({
  value,
  onChange,
  placeholder,
  className,
  availableFields = [],
  multiline = false
}: MentionInputProps) {
  const [showMentions, setShowMentions] = useState(false)
  const [mentionSearch, setMentionSearch] = useState('')
  const [cursorPosition, setCursorPosition] = useState(0)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  // Build mention options from available fields
  const mentionOptions: MentionOption[] = [
    ...DEFAULT_MENTIONS,
    ...availableFields
      .filter(field => ['text', 'email', 'name', 'phone', 'number'].includes(field.type))
      .map(field => ({
        id: field.id,
        label: field.label,
        value: `{{${field.id}}}`
      }))
  ]

  // Filter mentions based on search
  const filteredMentions = mentionOptions.filter(mention =>
    mention.label.toLowerCase().includes(mentionSearch.toLowerCase())
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value
    const cursor = e.target.selectionStart || 0
    
    onChange(newValue)
    setCursorPosition(cursor)

    // Check if user typed @ to trigger mentions
    const textBeforeCursor = newValue.slice(0, cursor)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')
    
    if (lastAtIndex !== -1 && cursor - lastAtIndex <= 20) {
      const searchText = textBeforeCursor.slice(lastAtIndex + 1)
      setMentionSearch(searchText)
      setShowMentions(true)
    } else {
      setShowMentions(false)
    }
  }

  const insertMention = (mention: MentionOption) => {
    const textBeforeCursor = value.slice(0, cursorPosition)
    const textAfterCursor = value.slice(cursorPosition)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')
    
    if (lastAtIndex !== -1) {
      const beforeAt = textBeforeCursor.slice(0, lastAtIndex)
      const newValue = beforeAt + mention.value + textAfterCursor
      onChange(newValue)
      
      // Set cursor position after the inserted mention
      setTimeout(() => {
        const newCursorPos = beforeAt.length + mention.value.length
        inputRef.current?.setSelectionRange(newCursorPos, newCursorPos)
        inputRef.current?.focus()
      }, 0)
    }
    
    setShowMentions(false)
    setMentionSearch('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentions && filteredMentions.length > 0) {
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertMention(filteredMentions[0])
      } else if (e.key === 'Escape') {
        setShowMentions(false)
      }
    }
  }

  const InputComponent = multiline ? Textarea : Input

  return (
    <div className="relative">
      <Popover open={showMentions} onOpenChange={setShowMentions}>
        <PopoverTrigger asChild>
          <InputComponent
            ref={inputRef as any}
            value={value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cn(className, multiline && 'min-h-[60px] resize-none')}
          />
        </PopoverTrigger>
        <PopoverContent
          className="w-64 p-0"
          align="start"
          side="bottom"
          sideOffset={4}
        >
          <div className="max-h-48 overflow-y-auto">
            {filteredMentions.length > 0 ? (
              <div className="p-1">
                {filteredMentions.map((mention) => (
                  <button
                    key={mention.id}
                    onClick={() => insertMention(mention)}
                    className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100 transition-colors"
                  >
                    <div className="font-medium text-gray-900">{mention.label}</div>
                    <div className="text-xs text-gray-500 font-mono">{mention.value}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-3 text-sm text-gray-500">
                No matching fields found
              </div>
            )}
          </div>
          <div className="border-t border-gray-200 bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-600">
              Type <kbd className="px-1 py-0.5 bg-white border border-gray-300 rounded text-[10px]">@</kbd> to insert dynamic values
            </p>
          </div>
        </PopoverContent>
      </Popover>
      
      {/* Helper text showing available mentions */}
      <p className="mt-1 text-xs text-gray-500">
        Use @ to insert dynamic values like @firstName, @email, etc.
      </p>
    </div>
  )
}
