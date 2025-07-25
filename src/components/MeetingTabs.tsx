import React from 'react';
import { Meeting } from '../types';

interface MeetingTabsProps {
  currentMeeting: Meeting | null;
  recentMeetings: Meeting[];
  onSelectMeeting: (meeting: Meeting) => void;
}

export const MeetingTabs: React.FC<MeetingTabsProps> = ({
  currentMeeting,
  recentMeetings,
  onSelectMeeting,
}) => {
  if (!currentMeeting) {
    return null;
  }

  // Filter out the current meeting from recent meetings to avoid duplication
  const filteredRecentMeetings = recentMeetings.filter(
    meeting => meeting.id !== currentMeeting.id
  );

  return (
    <div className="flex items-center justify-between px-2">
      {/* Current meeting tab (larger and prominent) */}
      <div className="text-2xl font-bold text-gray-900 px-6 py-2 truncate max-w-96 border-b-2 border-blue-500 bg-blue-50 rounded-t-md">
        {currentMeeting.title}
      </div>
      
      {/* Previous meetings tabs (smaller, on the right) */}
      <div className="flex items-center space-x-2">
        {filteredRecentMeetings.slice().map((meeting, index) => (
          <button
            key={meeting.id}
            onClick={() => onSelectMeeting(meeting)}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-all duration-150 truncate max-w-32 border border-gray-300 hover:border-gray-400 shadow-sm hover:shadow-md"
            title={meeting.title}
          >
            {meeting.title}
          </button>
        ))}
      </div>
    </div>
  );
};