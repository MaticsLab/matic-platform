'use client';

import { useState, useEffect } from 'react';
import { Check, X, AlertCircle, Users } from 'lucide-react';
import { Dialog, DialogContent } from '@/ui-components/dialog';
import { Button } from '@/ui-components/button';
import type { Activity } from '@/types/activities-hubs';
import type { Participant } from '@/types/participants';

type AttendanceRecord = {
  participantId: string;
  status: 'present' | 'absent' | 'excused';
};

type TakeAttendanceDialogProps = {
  open: boolean;
  onClose: () => void;
  activity: Activity | null;
  sessionDate: string;
  sessionTime: { begin: string; end: string };
  participants: Participant[];
  onSave: (records: AttendanceRecord[]) => void;
};

export function TakeAttendanceDialog({ 
  open, 
  onClose, 
  activity, 
  sessionDate, 
  sessionTime,
  participants,
  onSave 
}: TakeAttendanceDialogProps) {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);

  // Initialize attendance records when participants change
  // Pre-populate with existing status if available
  useEffect(() => {
    setAttendanceRecords(
      participants.map(p => ({
        participantId: p.id,
        status: (p as any)._attendanceStatus || 'absent' as const
      }))
    );
  }, [participants]);

  const updateAttendance = (participantId: string, status: 'present' | 'absent' | 'excused') => {
    setAttendanceRecords(records =>
      records.map(r => r.participantId === participantId ? { ...r, status } : r)
    );
  };

  const markAllPresent = () => {
    setAttendanceRecords(records =>
      records.map(r => ({ ...r, status: 'present' as const }))
    );
  };

  const markAllAbsent = () => {
    setAttendanceRecords(records =>
      records.map(r => ({ ...r, status: 'absent' as const }))
    );
  };

  const handleSave = () => {
    onSave(attendanceRecords);
    onClose();
  };

  // For now, treat all participants as non-staff
  // Can add isStaff field to Participant type later if needed
  const staff: Participant[] = [];
  const enrolledParticipants = participants;

  const presentCount = attendanceRecords.filter(r => r.status === 'present').length;
  const absentCount = attendanceRecords.filter(r => r.status === 'absent').length;
  const excusedCount = attendanceRecords.filter(r => r.status === 'excused').length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-full md:max-w-4xl h-[100vh] md:h-[90vh] overflow-hidden flex flex-col p-0 gap-0" 
        aria-describedby={undefined}
      >
        {/* Compact Header */}
        <div className="bg-gradient-to-r from-violet-600 to-violet-700 text-white px-3 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <div>
              <h2 className="text-lg md:text-2xl font-semibold">Take Attendance</h2>
              {activity && (
                <p className="text-xs md:text-sm text-violet-200 mt-1">{activity.name}</p>
              )}
            </div>
            <Button
              size="sm"
              className="bg-white text-violet-600 hover:bg-violet-50 h-9 text-xs md:text-sm"
              onClick={handleSave}
            >
              <Check className="h-4 w-4 md:mr-1.5" />
              <span className="hidden md:inline">Save</span>
            </Button>
          </div>

          {/* Compact Stats */}
          <div className="grid grid-cols-3 gap-2 md:gap-3">
            <div className="text-center">
              <div className="text-2xl md:text-4xl font-bold mb-0.5 md:mb-1">{presentCount}</div>
              <div className="text-[10px] md:text-xs text-violet-200">Present</div>
            </div>
            <div className="text-center">
              <div className="text-2xl md:text-4xl font-bold mb-0.5 md:mb-1">{absentCount}</div>
              <div className="text-[10px] md:text-xs text-violet-200">Absent</div>
            </div>
            <div className="text-center">
              <div className="text-2xl md:text-4xl font-bold mb-0.5 md:mb-1">{excusedCount}</div>
              <div className="text-[10px] md:text-xs text-violet-200">Excused</div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white px-3 md:px-6 py-2 md:py-3 border-b border-gray-200">
          <div className="grid grid-cols-2 gap-2 md:gap-3">
            <button
              onClick={markAllPresent}
              className="h-11 md:h-12 rounded-xl border-2 border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 active:bg-emerald-200 transition-colors flex items-center justify-center gap-1.5 md:gap-2 font-medium"
            >
              <Check className="h-4 md:h-5 w-4 md:w-5" />
              <span className="text-xs md:text-sm">All Present</span>
            </button>
            <button
              onClick={markAllAbsent}
              className="h-11 md:h-12 rounded-xl border-2 border-gray-300 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors flex items-center justify-center gap-1.5 md:gap-2 font-medium"
            >
              <X className="h-4 md:h-5 w-4 md:w-5" />
              <span className="text-xs md:text-sm">All Absent</span>
            </button>
          </div>
        </div>

        {/* Compact Participant List */}
        <div className="flex-1 overflow-auto bg-white">
          <div className="px-3 md:px-6 py-3 md:py-4">
            {/* Staff Section */}
            {staff.length > 0 && (
              <div className="mb-3 md:mb-4">
                <div className="bg-gray-900 text-white px-3 md:px-4 py-1.5 md:py-2 rounded-t-xl flex items-center gap-2">
                  <Users className="h-3.5 md:h-4 w-3.5 md:w-4" />
                  <span className="text-xs md:text-sm font-medium">Staff ({staff.length})</span>
                </div>
                <div className="border border-gray-200 rounded-b-xl overflow-hidden">
                  {staff.map((person, index) => {
                    const record = attendanceRecords.find(r => r.participantId === person.id);
                    const fullName = `${person.last_name}, ${person.first_name}`;
                    return (
                      <div 
                        key={person.id} 
                        className={`p-2.5 md:p-3 flex items-center justify-between gap-2 md:gap-4 ${index !== staff.length - 1 ? 'border-b border-gray-200' : ''}`}
                      >
                        <div className="text-xs md:text-sm text-gray-900 flex-1 min-w-0 truncate font-medium">{fullName}</div>
                        <div className="flex gap-1.5 md:gap-2 flex-shrink-0">
                          <button
                            onClick={() => updateAttendance(person.id, 'present')}
                            className={`h-11 md:h-8 w-11 md:w-auto md:px-3 rounded-lg transition-all flex items-center justify-center gap-0 md:gap-1.5 text-xs font-medium ${
                              record?.status === 'present'
                                ? 'border-2 border-emerald-500 bg-emerald-50 text-emerald-700'
                                : 'border border-gray-300 bg-white text-gray-600 hover:border-emerald-300 active:bg-emerald-50'
                            }`}
                          >
                            <Check className="h-4 md:h-3.5 w-4 md:w-3.5" />
                            <span className="hidden md:inline">Present</span>
                          </button>
                          <button
                            onClick={() => updateAttendance(person.id, 'absent')}
                            className={`h-11 md:h-8 w-11 md:w-auto md:px-3 rounded-lg transition-all flex items-center justify-center gap-0 md:gap-1.5 text-xs font-medium ${
                              record?.status === 'absent'
                                ? 'border-2 border-gray-400 bg-gray-50 text-gray-700'
                                : 'border border-gray-300 bg-white text-gray-600 hover:border-gray-400 active:bg-gray-50'
                            }`}
                          >
                            <X className="h-4 md:h-3.5 w-4 md:w-3.5" />
                            <span className="hidden md:inline">Absent</span>
                          </button>
                          <button
                            onClick={() => updateAttendance(person.id, 'excused')}
                            className={`h-11 md:h-8 w-11 md:w-auto md:px-3 rounded-lg transition-all flex items-center justify-center gap-0 md:gap-1.5 text-xs font-medium ${
                              record?.status === 'excused'
                                ? 'border-2 border-amber-500 bg-amber-50 text-amber-700'
                                : 'border border-gray-300 bg-white text-gray-600 hover:border-amber-300 active:bg-amber-50'
                            }`}
                          >
                            <AlertCircle className="h-4 md:h-3.5 w-4 md:w-3.5" />
                            <span className="hidden md:inline">Excused</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Participants Section */}
            <div>
              <div className="bg-violet-600 text-white px-3 md:px-4 py-1.5 md:py-2 rounded-t-xl flex items-center gap-2">
                <Users className="h-3.5 md:h-4 w-3.5 md:w-4" />
                <span className="text-xs md:text-sm font-medium">Participants ({participants.length})</span>
              </div>
              <div className="border border-gray-200 rounded-b-xl overflow-hidden">
                {enrolledParticipants.map((person, index) => {
                  const record = attendanceRecords.find(r => r.participantId === person.id);
                  const fullName = `${person.last_name}, ${person.first_name}`;
                  return (
                    <div
                      key={person.id}
                      className={`p-2.5 md:p-3 flex items-center justify-between gap-2 md:gap-4 ${index !== enrolledParticipants.length - 1 ? 'border-b border-gray-200' : ''}`}
                    >
                      <div className="text-xs md:text-sm text-gray-900 flex-1 min-w-0 truncate font-medium">{fullName}</div>
                      <div className="flex gap-1.5 md:gap-2 flex-shrink-0">
                        <button
                          onClick={() => updateAttendance(person.id, 'present')}
                          className={`h-11 md:h-8 w-11 md:w-auto md:px-3 rounded-lg transition-all flex items-center justify-center gap-0 md:gap-1.5 text-xs font-medium ${
                            record?.status === 'present'
                              ? 'border-2 border-emerald-500 bg-emerald-50 text-emerald-700'
                              : 'border border-gray-300 bg-white text-gray-600 hover:border-emerald-300 active:bg-emerald-50'
                          }`}
                        >
                          <Check className="h-4 md:h-3.5 w-4 md:w-3.5" />
                          <span className="hidden md:inline">Present</span>
                        </button>
                        <button
                          onClick={() => updateAttendance(person.id, 'absent')}
                          className={`h-11 md:h-8 w-11 md:w-auto md:px-3 rounded-lg transition-all flex items-center justify-center gap-0 md:gap-1.5 text-xs font-medium ${
                            record?.status === 'absent'
                              ? 'border-2 border-gray-400 bg-gray-50 text-gray-700'
                              : 'border border-gray-300 bg-white text-gray-600 hover:border-gray-400 active:bg-gray-50'
                          }`}
                        >
                          <X className="h-4 md:h-3.5 w-4 md:w-3.5" />
                          <span className="hidden md:inline">Absent</span>
                        </button>
                        <button
                          onClick={() => updateAttendance(person.id, 'excused')}
                          className={`h-11 md:h-8 w-11 md:w-auto md:px-3 rounded-lg transition-all flex items-center justify-center gap-0 md:gap-1.5 text-xs font-medium ${
                            record?.status === 'excused'
                              ? 'border-2 border-amber-500 bg-amber-50 text-amber-700'
                              : 'border border-gray-300 bg-white text-gray-600 hover:border-amber-300 active:bg-amber-50'
                          }`}
                        >
                          <AlertCircle className="h-4 md:h-3.5 w-4 md:w-3.5" />
                          <span className="hidden md:inline">Excused</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Compact Footer */}
        <div className="bg-white border-t border-gray-200 px-3 md:px-6 py-2.5 md:py-3">
          <div className="grid grid-cols-2 gap-2 md:gap-3">
            <Button 
              variant="outline"
              className="h-11 md:h-12 text-xs md:text-sm"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button 
              className="h-11 md:h-12 bg-violet-600 hover:bg-violet-700 text-white text-xs md:text-sm"
              onClick={handleSave}
            >
              <Check className="h-4 w-4 md:mr-2" />
              <span className="hidden sm:inline">Save Attendance</span>
              <span className="sm:hidden">Save</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
