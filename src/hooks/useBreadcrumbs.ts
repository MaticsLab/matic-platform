'use client'

import { useEffect } from 'react'
import { useBreadcrumb, BreadcrumbItem } from '@/components/BreadcrumbProvider'

/**
 * Hook to set breadcrumbs for the current page
 *
 * @example
 * ```tsx
 * function TablePage() {
 *   useBreadcrumbs([
 *     { label: 'Tables', href: '/workspace/acme/tables' },
 *     { label: 'Applicants', href: '/workspace/acme/tables/123' }
 *   ])
 *
 *   return <div>Table content</div>
 * }
 * ```
 */
export function useBreadcrumbs(
  items: BreadcrumbItem[],
  options?: {
    title?: string
    actions?: React.ReactNode
  }
) {
  const { setBreadcrumbs, setPageTitle, setPageActions } = useBreadcrumb()

  useEffect(() => {
    setBreadcrumbs(items)

    if (options?.title !== undefined) {
      setPageTitle(options.title)
    }

    if (options?.actions !== undefined) {
      setPageActions(options.actions)
    }

    // Cleanup on unmount
    return () => {
      setBreadcrumbs([])
      setPageTitle(null)
      setPageActions(null)
    }
  }, [items, options?.title, options?.actions, setBreadcrumbs, setPageTitle, setPageActions])
}

/**
 * Hook to set page title and actions without breadcrumbs
 */
export function usePageHeader(title: string, actions?: React.ReactNode) {
  const { setPageTitle, setPageActions } = useBreadcrumb()

  useEffect(() => {
    setPageTitle(title)

    if (actions !== undefined) {
      setPageActions(actions)
    }

    return () => {
      setPageTitle(null)
      setPageActions(null)
    }
  }, [title, actions, setPageTitle, setPageActions])
}
