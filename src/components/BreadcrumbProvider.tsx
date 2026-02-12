'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'

export interface BreadcrumbItem {
  label: string
  href: string
  icon?: any
}

interface BreadcrumbContextType {
  breadcrumbs: BreadcrumbItem[]
  setBreadcrumbs: (items: BreadcrumbItem[]) => void
  addBreadcrumb: (item: BreadcrumbItem) => void
  pageTitle: string | null
  setPageTitle: (title: string | null) => void
  pageActions: React.ReactNode | null
  setPageActions: (actions: React.ReactNode | null) => void
}

const BreadcrumbContext = createContext<BreadcrumbContextType>({
  breadcrumbs: [],
  setBreadcrumbs: () => {},
  addBreadcrumb: () => {},
  pageTitle: null,
  setPageTitle: () => {},
  pageActions: null,
  setPageActions: () => {},
})

export const useBreadcrumb = () => useContext(BreadcrumbContext)

interface BreadcrumbProviderProps {
  children: React.ReactNode
  workspaceSlug?: string
}

export function BreadcrumbProvider({ children, workspaceSlug }: BreadcrumbProviderProps) {
  const pathname = usePathname()
  const [breadcrumbs, setBreadcrumbsState] = useState<BreadcrumbItem[]>([])
  const [pageTitle, setPageTitleState] = useState<string | null>(null)
  const [pageActions, setPageActionsState] = useState<React.ReactNode | null>(null)

  // Memoize setter functions to prevent infinite loops in useBreadcrumbs hook
  const setBreadcrumbs = useCallback((items: BreadcrumbItem[]) => {
    setBreadcrumbsState(items)
  }, [])

  const setPageTitle = useCallback((title: string | null) => {
    setPageTitleState(title)
  }, [])

  const setPageActions = useCallback((actions: React.ReactNode | null) => {
    setPageActionsState(actions)
  }, [])

  const addBreadcrumb = useCallback((item: BreadcrumbItem) => {
    setBreadcrumbsState(prev => [...prev, item])
  }, [])

  return (
    <BreadcrumbContext.Provider
      value={{
        breadcrumbs,
        setBreadcrumbs,
        addBreadcrumb,
        pageTitle,
        setPageTitle,
        pageActions,
        setPageActions,
      }}
    >
      {children}
    </BreadcrumbContext.Provider>
  )
}
