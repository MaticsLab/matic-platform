'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/ui-components/button';
import { Badge } from '@/ui-components/badge';
import { Submission } from './types';
import { cn } from '@/lib/utils';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
} from 'date-fns';

interface CalendarViewProps {
  submissions: Submission[];
  onSubmissionClick: (submission: Submission) => void;
}

const STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-blue-500',
  'in-review': 'bg-yellow-500',
  approved: 'bg-green-500',
  rejected: 'bg-red-500',
  pending: 'bg-gray-500',
};

export function CalendarView({ submissions, onSubmissionClick }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Group submissions by date
  const submissionsByDate = useMemo(() => {
    const groups: Record<string, Submission[]> = {};
    
    submissions.forEach((sub) => {
      try {
        const date = parseISO(sub.submittedDate);
        const dateKey = format(date, 'yyyy-MM-dd');
        if (!groups[dateKey]) {
          groups[dateKey] = [];
        }
        groups[dateKey].push(sub);
      } catch (error) {
        console.error('Invalid date:', sub.submittedDate);
      }
    });

    return groups;
  }, [submissions]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const days = [];
    let day = startDate;

    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }

    return days;
  }, [currentMonth]);

  const previousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
    setSelectedDate(new Date());
  };

  const getSubmissionsForDate = (date: Date): Submission[] => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return submissionsByDate[dateKey] || [];
  };

  const selectedDateSubmissions = selectedDate ? getSubmissionsForDate(selectedDate) : [];

  return (
    <div className="flex-1 flex overflow-hidden bg-white">
      {/* Calendar */}
      <div className="flex-1 flex flex-col overflow-hidden border-r">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={previousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Weekday Headers */}
        <div className="grid grid-cols-7 border-b bg-gray-50">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div
              key={day}
              className="p-2 text-center text-sm font-medium text-gray-600"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-7 auto-rows-fr min-h-full">
            {calendarDays.map((day, index) => {
              const daySubmissions = getSubmissionsForDate(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const isTodayDate = isToday(day);

              return (
                <div
                  key={index}
                  className={cn(
                    'min-h-[100px] p-2 border-b border-r cursor-pointer hover:bg-gray-50 transition-colors',
                    !isCurrentMonth && 'bg-gray-50 text-gray-400',
                    isSelected && 'bg-blue-50 border-blue-300',
                    isTodayDate && 'bg-blue-50/50'
                  )}
                  onClick={() => setSelectedDate(day)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={cn(
                        'text-sm font-medium',
                        isTodayDate && 'text-blue-600 font-bold',
                        !isCurrentMonth && 'text-gray-400'
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                    {daySubmissions.length > 0 && (
                      <Badge
                        variant="secondary"
                        className="h-5 min-w-5 px-1 text-xs"
                      >
                        {daySubmissions.length}
                      </Badge>
                    )}
                  </div>

                  {/* Submission indicators */}
                  <div className="space-y-1">
                    {daySubmissions.slice(0, 3).map((submission, idx) => {
                      const status = submission.status.toLowerCase().replace(/\s+/g, '-');
                      return (
                        <div
                          key={submission.id}
                          className={cn(
                            'text-xs p-1 rounded truncate text-white',
                            STATUS_COLORS[status] || 'bg-gray-500'
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSubmissionClick(submission);
                          }}
                        >
                          {submission.name || submission.email}
                        </div>
                      );
                    })}
                    {daySubmissions.length > 3 && (
                      <div className="text-xs text-gray-500 pl-1">
                        +{daySubmissions.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sidebar - Selected Date Details */}
      {selectedDate && (
        <div className="w-80 flex flex-col overflow-hidden">
          <div className="p-4 border-b bg-gray-50">
            <h3 className="font-semibold text-lg">
              {format(selectedDate, 'MMMM d, yyyy')}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {selectedDateSubmissions.length} submission(s)
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {selectedDateSubmissions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">No submissions on this date</p>
              </div>
            ) : (
              selectedDateSubmissions.map((submission) => {
                const status = submission.status.toLowerCase().replace(/\s+/g, '-');
                return (
                  <div
                    key={submission.id}
                    className="p-3 border rounded-lg hover:shadow-md transition-shadow cursor-pointer bg-white"
                    onClick={() => onSubmissionClick(submission)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-medium">
                          {submission.firstName?.[0] || submission.name?.[0] || '?'}
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {submission.name || `${submission.firstName} ${submission.lastName}`.trim()}
                          </p>
                          <p className="text-xs text-gray-500">{submission.email}</p>
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn(
                        'text-xs capitalize',
                        STATUS_COLORS[status] && 'text-white',
                        STATUS_COLORS[status]
                      )}
                    >
                      {submission.status}
                    </Badge>
                    {submission.phone && (
                      <p className="text-xs text-gray-500 mt-2">{submission.phone}</p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
