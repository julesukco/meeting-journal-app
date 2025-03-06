import React from 'react';
import { CalendarDays, Plus, ArrowUp, ArrowDown } from 'lucide-react';
import { Meeting } from '../types';

interface MeetingListProps {
  meetings: Meeting[];
  selectedMeeting: Meeting | null;
  onSelectMeeting: (meeting: Meeting) => void;
  onNewMeeting: () => void;
  onReorderMeeting?: (meetingId: string, direction: 'up' | 'down') => void;
}

export function MeetingList({
  meetings,
  selectedMeeting,
  onSelectMeeting,
  onNewMeeting,
  onReorderMeeting,
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
        {meetings.map((meeting, index) => (
          <div
            key={meeting.id}
            className={`p-3 rounded-lg mb-2 cursor-pointer ${
              selectedMeeting?.id === meeting.id
                ? 'bg-blue-100 border-blue-200'
                : 'hover:bg-gray-100'
            }`}
          >
            <div className="flex justify-between items-center">
              <div 
                className="font-medium text-gray-800 mb-1 flex-1 truncate mr-2"
                onClick={() => onSelectMeeting(meeting)}
              >
                {meeting.title}
              </div>
              
              {onReorderMeeting && (
                <div className="flex flex-col ml-1 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onReorderMeeting(meeting.id, 'up');
                    }}
                    disabled={index === 0}
                    className={`p-0.5 rounded ${
                      index === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-200'
                    }`}
                    title="Move up"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onReorderMeeting(meeting.id, 'down');
                    }}
                    disabled={index === meetings.length - 1}
                    className={`p-0.5 rounded ${
                      index === meetings.length - 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-200'
                    }`}
                    title="Move down"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}