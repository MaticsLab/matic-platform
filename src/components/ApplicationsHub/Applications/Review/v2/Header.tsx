'use client';

import { HeaderProps } from './types';
import { ChevronLeft, FileText, Workflow, BarChart3, Users, PenTool, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Header({ formName, activeView, onViewChange, onBack }: HeaderProps) {
  const navItems = [
    { id: 'review' as const, label: 'Review', icon: FileText },
    { id: 'workflows' as const, label: 'Workflows', icon: Workflow },
    { id: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
    { id: 'team' as const, label: 'Team', icon: Users },
    { id: 'portal' as const, label: 'Portal Builder', icon: PenTool },
    { id: 'share' as const, label: 'Share', icon: Share2 },
  ];

  return (
    <header className="bg-white border-b">
      <div className="px-6 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={onBack}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <h1 className="text-gray-900 font-medium">{formName || 'Applications'}</h1>
          </div>

          <div className="flex items-center gap-1.5">
            {navItems.map((item, idx) => (
              <div key={item.id} className="flex items-center">
                <button 
                  onClick={() => onViewChange(item.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors text-sm",
                    activeView === item.id 
                      ? "bg-blue-50 text-blue-700" 
                      : "hover:bg-gray-100 text-gray-700"
                  )}
                >
                  <item.icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
                {idx === 2 && (
                  <div className="w-px h-5 bg-gray-200 mx-1.5" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
