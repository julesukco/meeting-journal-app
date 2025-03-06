import React from 'react';
import { CalendarDays, Plus } from 'lucide-react';
import { Meeting } from '../types';

interface MeetingListProps {
  meetings: Meeting[];
  selectedMeeting: Meeting | null;
  onSelectMeeting: (meeting: Meeting) => void;
  onNewMeeting: () => void;
}

export function MeetingList({
  meetings,
  selectedMeeting,
  onSelectMeeting,
  onNewMeeting,
}: MeetingListProps) {
  return (
    <div className="w-64 bg-gray-50 border-r border-gray-200 p-4 flex flex-col h-screen">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-700">Meetings</h2>
        <button
          onClick={onNewMeeting}
          className="p-1 hover:bg-gray-200 rounded-full transition-colors"
          title="New Meeting"
        >
          <Plus className="w-5 h-5 text-gray-600" />
        </button>
      </div>
      <div className="overflow-y-auto flex-1">
        {meetings.map((meeting) => (
          <div
            key={meeting.id}
            onClick={() => onSelectMeeting(meeting)}
            className={`p-3 rounded-lg mb-2 cursor-pointer ${
              selectedMeeting?.id === meeting.id
                ? 'bg-blue-100 border-blue-200'
                : 'hover:bg-gray-100'
            }`}
          >
            <div className="font-medium text-gray-800 mb-1">{meeting.title}</div>
          </div>
        ))}
      </div>
    </div>
  );
}