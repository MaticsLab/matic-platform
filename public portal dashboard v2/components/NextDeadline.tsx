import { Card } from './ui/card';
import { Calendar } from 'lucide-react';

export function NextDeadline() {
  return (
    <Card className="p-4 border border-blue-200 bg-blue-50/30">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Calendar className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-600 mb-0.5">Next Deadline</p>
          <p className="text-sm text-gray-900">Document Submission - March 10, 2025</p>
        </div>
      </div>
    </Card>
  );
}
