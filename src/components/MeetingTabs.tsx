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
    <div className="flex items-center justify-center space-x-3 px-2">
      {/* Previous meetings tabs (smaller, on the left) */}
      {filteredRecentMeetings.slice().reverse().map((meeting, index) => (
        <button
          key={meeting.id}
          onClick={() => onSelectMeeting(meeting)}
          className="px-2 py-1 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-md transition-all duration-150 truncate max-w-32 border border-transparent hover:border-gray-200"
          title={meeting.title}
        >
          {meeting.title}
        </button>
      ))}
      
      {/* Current meeting tab (larger and prominent) */}
      <div className="text-2xl font-bold text-gray-900 px-6 py-2 truncate max-w-96 border-b-2 border-blue-500">
        {currentMeeting.title}
      </div>
    </div>
  );
};