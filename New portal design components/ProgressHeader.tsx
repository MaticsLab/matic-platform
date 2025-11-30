import { useState } from 'react';
import { Save, Clock, History, Download, Moon, Sun } from 'lucide-react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { ApplicationData } from './ApplicationForm';

interface ProgressHeaderProps {
  progress: number;
  isSaving: boolean;
  lastSaved: Date | null;
  onSave: () => void;
  versionHistory: { date: Date; data: ApplicationData }[];
  onRestoreVersion: (version: { date: Date; data: ApplicationData }) => void;
}

export function ProgressHeader({
  progress,
  isSaving,
  lastSaved,
  onSave,
  versionHistory,
  onRestoreVersion
}: ProgressHeaderProps) {
  const [highContrast, setHighContrast] = useState(false);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const estimatedTimeRemaining = Math.max(0, Math.ceil((100 - progress) / 10) * 2);

  return (
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-4 pl-16 lg:pl-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Progress Section */}
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-700">Overall Progress</span>
            <span className="text-blue-600">{progress}% Complete</span>
          </div>
          <Progress value={progress} className="h-2" />
          {progress < 100 && estimatedTimeRemaining > 0 && (
            <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
              <Clock className="h-3 w-3" />
              <span>~{estimatedTimeRemaining} min remaining</span>
            </div>
          )}
        </div>

        {/* Actions Section */}
        <div className="flex items-center gap-2">
          {/* Version History */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <History className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">History</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Version History</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {versionHistory.length === 0 ? (
                <div className="px-2 py-4 text-sm text-gray-500 text-center">
                  No saved versions yet
                </div>
              ) : (
                versionHistory
                  .slice()
                  .reverse()
                  .map((version, index) => (
                    <DropdownMenuItem
                      key={index}
                      onClick={() => onRestoreVersion(version)}
                      className="cursor-pointer"
                    >
                      <div>
                        <div className="text-sm">
                          Version {versionHistory.length - index}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatDateTime(version.date)}
                        </div>
                      </div>
                    </DropdownMenuItem>
                  ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Save Version Button */}
          <Button variant="outline" size="sm" onClick={onSave}>
            <Save className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Save Version</span>
          </Button>

          {/* Accessibility Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setHighContrast(!highContrast);
              document.documentElement.classList.toggle('high-contrast');
            }}
            aria-label="Toggle high contrast mode"
            title="Toggle high contrast mode"
          >
            {highContrast ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>

          {/* Save & Exit */}
          <Button size="sm">
            <Download className="h-4 w-4 mr-2" />
            Save & Exit
          </Button>
        </div>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="hidden lg:block mt-2 text-xs text-gray-500">
        <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded">Ctrl</kbd> +{' '}
        <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded">S</kbd> to save •{' '}
        <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded">Ctrl</kbd> +{' '}
        <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded">→</kbd> next section
      </div>
    </header>
  );
}