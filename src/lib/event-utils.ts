/**
 * Event Handler Utilities
 * Helpers for better event handling patterns across the app
 */

import { useCallback, useEffect, useRef } from 'react'

/**
 * Debounce function - delays execution until after wait period
 * Useful for search inputs, resize handlers, etc.
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }

    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

/**
 * Throttle function - limits execution to once per wait period
 * Useful for scroll handlers, mousemove, etc.
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), wait)
    }
  }
}

/**
 * Hook: Debounced callback
 * Usage: const debouncedSearch = useDebouncedCallback(handleSearch, 300)
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout>()

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args)
      }, delay)
    },
    [callback, delay]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return debouncedCallback
}

/**
 * Hook: Throttled callback
 * Usage: const throttledScroll = useThrottledCallback(handleScroll, 100)
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const lastRun = useRef<number>(Date.now())

  const throttledCallback = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now()
      
      if (now - lastRun.current >= delay) {
        callback(...args)
        lastRun.current = now
      }
    },
    [callback, delay]
  )

  return throttledCallback
}

/**
 * Hook: Event listener with automatic cleanup
 * Usage: useEventListener('keydown', handleKeyDown)
 */
export function useEventListener<K extends keyof WindowEventMap>(
  eventName: K,
  handler: (event: WindowEventMap[K]) => void,
  element: Window | HTMLElement | null = typeof window !== 'undefined' ? window : null,
  options?: boolean | AddEventListenerOptions
) {
  const savedHandler = useRef(handler)

  // Update ref when handler changes to avoid stale closures
  useEffect(() => {
    savedHandler.current = handler
  }, [handler])

  useEffect(() => {
    if (!element?.addEventListener) return

    const eventListener = (event: Event) => savedHandler.current(event as WindowEventMap[K])

    element.addEventListener(eventName, eventListener, options)

    return () => {
      element.removeEventListener(eventName, eventListener, options)
    }
  }, [eventName, element, options])
}

/**
 * Hook: Click outside detector
 * Usage: useClickOutside(ref, () => setIsOpen(false))
 */
export function useClickOutside<T extends HTMLElement = HTMLElement>(
  ref: React.RefObject<T>,
  handler: (event: MouseEvent | TouchEvent) => void,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return

    const listener = (event: MouseEvent | TouchEvent) => {
      const el = ref?.current
      
      // Do nothing if clicking ref's element or descendent elements
      if (!el || el.contains(event.target as Node)) {
        return
      }

      handler(event)
    }

    document.addEventListener('mousedown', listener)
    document.addEventListener('touchstart', listener)

    return () => {
      document.removeEventListener('mousedown', listener)
      document.removeEventListener('touchstart', listener)
    }
  }, [ref, handler, enabled])
}

/**
 * Hook: Keyboard shortcut handler
 * Usage: useKeyPress('Escape', handleClose)
 */
export function useKeyPress(
  targetKey: string,
  handler: () => void,
  options?: {
    ctrl?: boolean
    shift?: boolean
    alt?: boolean
    meta?: boolean
  }
) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const { ctrl, shift, alt, meta } = options || {}

      if (
        event.key === targetKey &&
        (ctrl === undefined || event.ctrlKey === ctrl) &&
        (shift === undefined || event.shiftKey === shift) &&
        (alt === undefined || event.altKey === alt) &&
        (meta === undefined || event.metaKey === meta)
      ) {
        event.preventDefault()
        handler()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [targetKey, handler, options])
}

/**
 * Hook: Prevent default form submission
 * Usage: const handleSubmit = usePreventDefault(async () => { ... })
 */
export function usePreventDefault<T extends HTMLElement = HTMLFormElement>(
  callback: () => void | Promise<void>
) {
  return useCallback(
    (event: React.FormEvent<T>) => {
      event.preventDefault()
      event.stopPropagation()
      callback()
    },
    [callback]
  )
}

/**
 * Stop event propagation helper
 * Usage: onClick={stopPropagation(() => doSomething())}
 */
export function stopPropagation<T = any>(
  handler?: (event: T) => void
): (event: T) => void {
  return (event: T) => {
    if ('stopPropagation' in (event as any)) {
      (event as any).stopPropagation()
    }
    handler?.(event)
  }
}

/**
 * Prevent default helper
 * Usage: onClick={preventDefault(() => doSomething())}
 */
export function preventDefault<T = any>(
  handler?: (event: T) => void
): (event: T) => void {
  return (event: T) => {
    if ('preventDefault' in (event as any)) {
      (event as any).preventDefault()
    }
    handler?.(event)
  }
}
