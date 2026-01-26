/**
 * Global Toast Helper
 * Centralized toast notifications using sonner
 * 
 * Usage:
 * import { toast } from '@/lib/toast'
 * 
 * toast.success('Operation successful')
 * toast.error('Something went wrong')
 * toast.info('Information message')
 * toast.warning('Warning message')
 * toast.promise(promise, { loading: 'Loading...', success: 'Done!', error: 'Failed' })
 */

import { toast as sonnerToast } from 'sonner'

// Re-export sonner toast with our customizations
export const toast = {
  success: (message: string, options?: Parameters<typeof sonnerToast.success>[1]) => {
    return sonnerToast.success(message, {
      duration: 3000,
      ...options,
    })
  },
  
  error: (message: string, options?: Parameters<typeof sonnerToast.error>[1]) => {
    return sonnerToast.error(message, {
      duration: 4000,
      ...options,
    })
  },
  
  info: (message: string, options?: Parameters<typeof sonnerToast.info>[1]) => {
    return sonnerToast.info(message, {
      duration: 3000,
      ...options,
    })
  },
  
  warning: (message: string, options?: Parameters<typeof sonnerToast.warning>[1]) => {
    return sonnerToast.warning(message, {
      duration: 3500,
      ...options,
    })
  },
  
  promise: <T,>(
    promise: Promise<T>,
    options: {
      loading: string
      success: string | ((data: T) => string)
      error: string | ((error: any) => string)
    }
  ) => {
    return sonnerToast.promise(promise, options)
  },
  
  // Custom message (no icon)
  message: (message: string, options?: Parameters<typeof sonnerToast>[1]) => {
    return sonnerToast(message, {
      duration: 3000,
      ...options,
    })
  },
  
  // Dismiss specific toast
  dismiss: (toastId?: string | number) => {
    return sonnerToast.dismiss(toastId)
  },
  
  // Loading state
  loading: (message: string, options?: Parameters<typeof sonnerToast.loading>[1]) => {
    return sonnerToast.loading(message, options)
  },
}
