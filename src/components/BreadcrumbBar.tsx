'use client'

import React from 'react'
import { ChevronRight, Home } from 'lucide-react'
import Link from 'next/link'
import { useBreadcrumb } from './BreadcrumbProvider'
import { cn } from '@/lib/utils'

export function BreadcrumbBar() {
  const { breadcrumbs, pageTitle, pageActions } = useBreadcrumb()

  return (
    <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200">
      {/* Left side - Breadcrumbs and Title */}
      <div className="flex items-center gap-4 min-w-0 flex-1">
        {/* Breadcrumbs */}
        {breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-2 text-sm text-gray-600">
            <Link
              href="/"
              className="flex items-center hover:text-gray-900 transition-colors"
            >
              <Home className="w-4 h-4" />
            </Link>

            {breadcrumbs.map((item, index) => {
              const isLast = index === breadcrumbs.length - 1
              const Icon = item.icon

              return (
                <React.Fragment key={item.href}>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                  {isLast ? (
                    <span className="font-medium text-gray-900 truncate">
                      {Icon && <Icon className="w-4 h-4 inline mr-1" />}
                      {item.label}
                    </span>
                  ) : (
                    <Link
                      href={item.href}
                      className="hover:text-gray-900 transition-colors truncate"
                    >
                      {Icon && <Icon className="w-4 h-4 inline mr-1" />}
                      {item.label}
                    </Link>
                  )}
                </React.Fragment>
              )
            })}
          </nav>
        )}

        {/* Page Title (if no breadcrumbs) */}
        {breadcrumbs.length === 0 && pageTitle && (
          <h1 className="text-lg font-semibold text-gray-900 truncate">
            {pageTitle}
          </h1>
        )}
      </div>

      {/* Right side - Page Actions */}
      {pageActions && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {pageActions}
        </div>
      )}
    </div>
  )
}
