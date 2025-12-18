import { Search, Bell, FileText, LogOut } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

export function DashboardHeader() {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base text-gray-900">Logan Scholarship</h2>
              <p className="text-xs text-gray-500">Application Portal</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <Button variant="outline" className="gap-2 text-xs sm:text-sm px-2 sm:px-4 h-8 sm:h-9">
              <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">My Application</span>
              <span className="xs:hidden">Application</span>
            </Button>
            
            <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 sm:py-2">
              <span className="text-xs text-gray-500">Deadline</span>
              <span className="text-xs text-gray-900">45 days</span>
            </div>
            
            <Button variant="ghost" size="icon" className="relative hover:bg-gray-100 h-8 w-8 sm:h-9 sm:w-9">
              <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </Button>
            
            <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-gray-200">
              <Button variant="outline" size="sm" className="gap-2 text-xs h-8 px-2 sm:px-3">
                <LogOut className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}