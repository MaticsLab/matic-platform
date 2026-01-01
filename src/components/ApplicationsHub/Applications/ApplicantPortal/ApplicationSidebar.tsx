'use client'

import { Check, ChevronRight, Menu, X, HelpCircle, Mail } from 'lucide-react'
import { Button } from '@/ui-components/button'
import { cn } from '@/lib/utils'
import { safeFieldString } from '@/components/Fields/types'

interface Section {
  id: string
  title: string
  icon?: any
}

interface ApplicationSidebarProps {
  sections: Section[]
  currentSection: number
  onSectionChange: (index: number) => void
  getSectionCompletion: (index: number) => number
  isSectionComplete: (index: number) => boolean
  isOpen: boolean
  onToggle: () => void
  formName?: string
  formDescription?: string
  helpEmail?: string
  isExternal?: boolean
  // UI translations
  ui?: {
    needHelp?: string
    contactUsDescription?: string
    sendEmail?: string
  }
}

export function ApplicationSidebar({
  sections,
  currentSection,
  onSectionChange,
  getSectionCompletion,
  isSectionComplete,
  isOpen,
  onToggle,
  formName = 'Application',
  formDescription,
  helpEmail = 'support@example.com',
  isExternal = false,
  ui = {}
}: ApplicationSidebarProps) {
  return (
    <>
      {/* Mobile Toggle Button */}
      <Button
        variant="ghost"
        size="sm"
        className="fixed top-4 left-4 z-50 lg:hidden bg-white shadow-md"
        onClick={onToggle}
        aria-label="Toggle sidebar"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "w-72 min-w-[18rem] max-w-[20rem] bg-white border-r border-gray-200 flex flex-col fixed lg:static inset-y-0 left-0 z-40 transition-transform duration-300",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center gap-3">
            {isExternal && (
              <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0">
                M
              </div>
            )}
            <div>
              <h2 className="font-semibold text-gray-900 truncate">
                {formName}
              </h2>
              {formDescription && (
                <p className="text-sm text-gray-600 mt-1">{formDescription}</p>
              )}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-1" role="list">
            {sections.map((section, index) => {
              const completion = getSectionCompletion(index)
              const isComplete = isSectionComplete(index)
              const isCurrent = currentSection === index
              const isReviewSection = section.id === 'review'

              return (
                <li key={section.id}>
                  <button
                    onClick={() => onSectionChange(index)}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center gap-3 group min-w-0",
                      isCurrent
                        ? isExternal 
                          ? "bg-gray-100 text-gray-900" 
                          : "bg-blue-50 text-blue-700"
                        : "hover:bg-gray-50 text-gray-700"
                    )}
                    aria-current={isCurrent ? "step" : undefined}
                  >
                    {/* Status Icon */}
                    <div
                      className={cn(
                        "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors text-sm font-medium",
                        isComplete
                          ? "bg-green-500 text-white"
                          : isCurrent
                          ? isExternal
                            ? "bg-gray-900 text-white"
                            : "bg-blue-500 text-white"
                          : "bg-gray-200 text-gray-600"
                      )}
                    >
                      {isComplete ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <span>{index + 1}</span>
                      )}
                    </div>

                    {/* Section Info */}
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="font-medium truncate overflow-hidden text-ellipsis whitespace-nowrap">
                        {safeFieldString(section.title)}
                      </div>
                      {!isComplete && !isReviewSection && (
                        <div className="flex items-center gap-2 mt-1 min-w-0">
                          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden min-w-0">
                            <div
                              className={cn(
                                "h-full transition-all duration-500 rounded-full",
                                completion >= 100
                                  ? "bg-green-500"
                                  : completion >= 50
                                  ? isExternal ? "bg-gray-600" : "bg-blue-500"
                                  : "bg-orange-500"
                              )}
                              style={{ width: `${completion}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 flex-shrink-0 w-8 text-right">
                            {completion}%
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Arrow for current */}
                    {isCurrent && (
                      <ChevronRight className={cn(
                        "h-4 w-4 flex-shrink-0",
                        isExternal ? "text-gray-900" : "text-blue-700"
                      )} />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Help Section */}
        <div className="p-4 border-t bg-gray-50">
          <div className="flex items-center gap-2 text-gray-900 font-medium mb-1">
            <HelpCircle className="h-4 w-4" />
            <span>{ui.needHelp || 'Need Help?'}</span>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            {ui.contactUsDescription || 'Contact us for assistance with your application.'}
          </p>
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            asChild
          >
            <a href={`mailto:${helpEmail}`}>
              <Mail className="h-4 w-4 mr-2" />
              {ui.sendEmail || 'Send Email'}
            </a>
          </Button>
        </div>
      </aside>
    </>
  )
}
