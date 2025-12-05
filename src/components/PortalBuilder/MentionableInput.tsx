'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { AtSign, ChevronDown } from 'lucide-react'
import { Input } from '@/ui-components/input'
import { Button } from '@/ui-components/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/ui-components/popover'
import { cn } from '@/lib/utils'
import type { Field } from '@/types/portal'

interface MentionableInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  previousFields: Field[]
  fieldId?: string
}

interface Mention {
  id: string
  label: string
  type: string
}

export function MentionableInput({
  value,
  onChange,
  placeholder = 'Enter text...',
  className,
  previousFields,
  fieldId,
}: MentionableInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [showMentions, setShowMentions] = useState(false)
  const [cursorPosition, setCursorPosition] = useState(0)
  const [mentionQuery, setMentionQuery] = useState('')

  // Get previous questions (input fields before this one)
  const availableMentions: Mention[] = previousFields
    .filter(f => {
      // Only show input/question type fields
      if (fieldId && f.id === fieldId) return false
      return ['text', 'textarea', 'email', 'phone', 'number', 'date', 'address'].includes(f.type)
    })
    .map(f => ({
      id: f.id,
      label: f.label || `Field ${f.id}`,
      type: f.type,
    }))

  const filteredMentions = availableMentions.filter(m =>
    m.label.toLowerCase().includes(mentionQuery.toLowerCase())
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.currentTarget.value
    const pos = e.currentTarget.selectionStart || 0
    
    onChange(newValue)
    setCursorPosition(pos)

    // Check if @ was typed
    if (newValue[pos - 1] === '@') {
      setMentionQuery('')
      setShowMentions(true)
    } else if (pos > 0 && newValue[pos - 1] === ' ') {
      setShowMentions(false)
    } else if (showMentions) {
      // Extract query after @
      const textBeforeCursor = newValue.substring(0, pos)
      const lastAtIndex = textBeforeCursor.lastIndexOf('@')
      if (lastAtIndex !== -1) {
        const query = textBeforeCursor.substring(lastAtIndex + 1)
        setMentionQuery(query)
      }
    }
  }

  const insertMention = (mention: Mention) => {
    if (!inputRef.current) return

    const pos = cursorPosition
    const textBeforeCursor = value.substring(0, pos)
    const textAfterCursor = value.substring(pos)

    // Find the @ symbol
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')
    if (lastAtIndex === -1) return

    // Replace from @ to cursor with the mention
    const newValue =
      textBeforeCursor.substring(0, lastAtIndex) +
      `{${mention.label}}` +
      textAfterCursor

    onChange(newValue)
    setShowMentions(false)
    setMentionQuery('')

    // Move cursor after the inserted mention
    setTimeout(() => {
      if (inputRef.current) {
        const newPos = lastAtIndex + mention.label.length + 2
        inputRef.current.setSelectionRange(newPos, newPos)
        inputRef.current.focus()
      }
    }, 0)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showMentions && e.key === 'Escape') {
      setShowMentions(false)
      e.preventDefault()
    }
  }

  return (
    <div className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn('font-medium pr-9', className)}
        />
        <Popover open={showMentions} onOpenChange={setShowMentions}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded transition-colors"
              onClick={() => setShowMentions(!showMentions)}
              title="Insert field reference"
            >
              <AtSign className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </button>
          </PopoverTrigger>
          {showMentions && (
            <PopoverContent side="bottom" align="end" className="w-64 p-0">
              <div className="bg-white rounded-lg shadow-lg border border-gray-200">
                {availableMentions.length === 0 ? (
                  <div className="p-3 text-xs text-gray-500 text-center">
                    No previous questions available
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto">
                    {mentionQuery && (
                      <div className="px-3 py-2 text-xs text-gray-500 border-b bg-gray-50">
                        Searching: <span className="font-medium">{mentionQuery}</span>
                      </div>
                    )}
                    {filteredMentions.length === 0 ? (
                      <div className="p-3 text-xs text-gray-500 text-center">
                        No matching fields
                      </div>
                    ) : (
                      <div className="divide-y">
                        {filteredMentions.map(mention => (
                          <button
                            key={mention.id}
                            type="button"
                            onClick={() => insertMention(mention)}
                            className="w-full px-3 py-2.5 text-left text-sm hover:bg-blue-50 transition-colors flex items-center gap-2"
                          >
                            <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded font-mono">
                              {'{' + mention.label + '}'}
                            </span>
                            <span className="text-xs text-gray-500 flex-1 truncate">
                              {mention.type}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </PopoverContent>
          )}
        </Popover>
      </div>

      {/* Show hint about @ mention */}
      <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
        <AtSign className="w-3 h-3" />
        <span>Type @ to reference previous questions</span>
      </div>
    </div>
  )
}
