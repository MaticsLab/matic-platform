import { ChevronLeft, FileText, Workflow, BarChart3, Users, PenTool, Share2, ChevronDown } from 'lucide-react';

interface HeaderProps {
  committee: string;
  onCommitteeChange: (value: string) => void;
}

export function Header({ committee, onCommitteeChange }: HeaderProps) {
  return (
    <header className="bg-white border-b">
      <div className="px-6 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <h1 className="text-gray-900">Scholarship</h1>
          </div>

          <div className="flex items-center gap-1.5">
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-700 text-sm">
              <FileText className="w-3.5 h-3.5" />
              <span>Review</span>
            </button>
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-700 text-sm">
              <Workflow className="w-3.5 h-3.5" />
              <span>Workflows</span>
            </button>
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-700 text-sm">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Analytics</span>
            </button>
            
            <div className="w-px h-5 bg-gray-200 mx-1.5" />
            
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-700 text-sm">
              <Users className="w-3.5 h-3.5" />
              <span>Team</span>
            </button>
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-700 text-sm">
              <PenTool className="w-3.5 h-3.5" />
              <span>Portal Builder</span>
            </button>
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-700 text-sm">
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}