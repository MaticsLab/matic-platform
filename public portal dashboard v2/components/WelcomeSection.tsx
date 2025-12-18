import { Sparkles } from 'lucide-react';
import { Badge } from './ui/badge';

export function WelcomeSection() {
  return (
    <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-6">
      <div className="flex-1">
        <h1 className="text-xl sm:text-2xl text-gray-900 mb-1">Good afternoon, Jose 👋</h1>
        <p className="text-sm text-gray-600">Here's an overview of your scholarship application.</p>
      </div>
      
      <div className="flex items-center gap-3 w-full sm:w-auto">
        <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg">
          <span className="text-xs text-gray-600">Status</span>
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">Submitted</Badge>
        </div>
      </div>
    </div>
  );
}