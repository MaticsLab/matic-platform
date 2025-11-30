import { Check, ChevronRight, Menu, X } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from './ui/utils';

interface Section {
  id: string;
  title: string;
}

interface ApplicationSidebarProps {
  sections: Section[];
  currentSection: number;
  onSectionChange: (index: number) => void;
  getSectionCompletion: (index: number) => number;
  isSectionComplete: (index: number) => boolean;
  isOpen: boolean;
  onToggle: () => void;
}

export function ApplicationSidebar({
  sections,
  currentSection,
  onSectionChange,
  getSectionCompletion,
  isSectionComplete,
  isOpen,
  onToggle
}: ApplicationSidebarProps) {
  return (
    <>
      {/* Mobile Toggle Button */}
      <Button
        variant="ghost"
        size="sm"
        className="fixed top-4 left-4 z-50 lg:hidden"
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
          "w-72 bg-white border-r border-gray-200 flex flex-col fixed lg:static inset-y-0 left-0 z-40 transition-transform duration-300",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="p-6 border-b">
          <h2 className="text-gray-900">
            Scholarship Application
          </h2>
          <p className="text-gray-600 mt-1">2024-2025 Academic Year</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-1" role="list">
            {sections.map((section, index) => {
              const completion = getSectionCompletion(index);
              const isComplete = isSectionComplete(index);
              const isCurrent = currentSection === index;
              const isAccessible = index <= currentSection || isComplete;

              return (
                <li key={section.id}>
                  <button
                    onClick={() => isAccessible && onSectionChange(index)}
                    disabled={!isAccessible}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center gap-3 group",
                      isCurrent
                        ? "bg-blue-50 text-blue-700"
                        : isAccessible
                        ? "hover:bg-gray-50 text-gray-700"
                        : "text-gray-400 cursor-not-allowed"
                    )}
                    aria-current={isCurrent ? "step" : undefined}
                  >
                    {/* Status Icon */}
                    <div
                      className={cn(
                        "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors",
                        isComplete
                          ? "bg-green-500 text-white"
                          : isCurrent
                          ? "bg-blue-500 text-white"
                          : "bg-gray-200 text-gray-600"
                      )}
                    >
                      {isComplete ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <span className="text-xs">{index + 1}</span>
                      )}
                    </div>

                    {/* Section Info */}
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{section.title}</div>
                      {!isComplete && index !== sections.length - 1 && (
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full transition-all duration-500",
                                completion >= 100
                                  ? "bg-green-500"
                                  : completion >= 50
                                  ? "bg-blue-500"
                                  : "bg-orange-500"
                              )}
                              style={{ width: `${completion}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">
                            {completion}%
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Arrow for current */}
                    {isCurrent && (
                      <ChevronRight className="h-4 w-4 flex-shrink-0 text-blue-700" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Help Section */}
        <div className="p-4 border-t bg-gray-50">
          <div className="text-gray-900 mb-1">Need Help?</div>
          <p className="text-sm text-gray-600 mb-3">
            Contact us at scholarships@university.edu
          </p>
          <Button variant="outline" size="sm" className="w-full" asChild>
            <a href="mailto:scholarships@university.edu">Send Email</a>
          </Button>
        </div>
      </aside>
    </>
  );
}
