'use client'

import { useState, useEffect } from 'react'

interface Toast {
  id: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  duration?: number
}

let toastId = 0

const toasts: Toast[] = []
const listeners: Array<(toasts: Toast[]) => void> = []

function notifyListeners() {
  listeners.forEach(listener => listener([...toasts]))
}

export function showToast(message: string, type: Toast['type'] = 'info', duration = 5000) {
  const toast: Toast = {
    id: (++toastId).toString(),
    message,
    type,
    duration
  }
  
  toasts.push(toast)
  notifyListeners()
  
  if (duration > 0) {
    setTimeout(() => {
      removeToast(toast.id)
    }, duration)
  }
  
  return toast.id
}

export function removeToast(id: string) {
  const index = toasts.findIndex(toast => toast.id === id)
  if (index > -1) {
    toasts.splice(index, 1)
    notifyListeners()
  }
}

export function useToasts() {
  const [currentToasts, setCurrentToasts] = useState<Toast[]>([])
  
  useEffect(() => {
    const listener = (newToasts: Toast[]) => {
      setCurrentToasts(newToasts)
    }
    
    listeners.push(listener)
    listener([...toasts]) // Initialize with current toasts
    
    return () => {
      const index = listeners.indexOf(listener)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [])
  
  return currentToasts
}

export function ToastContainer() {
  const toasts = useToasts()
  
  if (toasts.length === 0) return null
  
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`
            px-4 py-3 rounded-lg shadow-lg max-w-sm
            ${toast.type === 'info' ? 'bg-blue-500 text-white' : ''}
            ${toast.type === 'success' ? 'bg-green-500 text-white' : ''}
            ${toast.type === 'warning' ? 'bg-yellow-500 text-white' : ''}
            ${toast.type === 'error' ? 'bg-red-500 text-white' : ''}
            transition-all duration-300 ease-in-out
          `}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-2 text-white hover:text-muted-foreground"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}