"use client"

import { useState, useCallback } from 'react'
import { useKeyPress } from '@/lib/event-utils'

export function useOmniSearch() {
  const [isOpen, setIsOpen] = useState(false)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen(prev => !prev), [])

  // Cmd/Ctrl + K to open search
  useKeyPress('k', toggle, { meta: true })

  return {
    isOpen,
    open,
    close,
    toggle,
  }
}
