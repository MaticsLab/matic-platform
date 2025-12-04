'use client';

import { HeaderProps } from './types';
import { ChevronLeft } from 'lucide-react';

export function Header({ formName, onBack }: HeaderProps) {
  return (
    <header className="bg-white border-b">
      <div className="px-6 py-2">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <h1 className="text-gray-900 font-medium">{formName || 'Applications'}</h1>
        </div>
      </div>
    </header>
  );
}
