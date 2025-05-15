import React, { useState, useEffect } from 'react';
import { Meeting } from '../types';
import { getMeetings } from '../services/storage';
import { SearchDialog } from '../components/SearchDialog';

export const MeetingListScreen: React.FC = () => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    loadMeetings();
  }, []);

  const loadMeetings = async () => {
    const storedMeetings = await getMeetings();
    setMeetings(storedMeetings);
  };

  const handleMeetingSelect = (meeting: Meeting) => {
    setShowSearch(false);
    // Navigate to the meeting detail page
    window.location.href = `/meeting/${meeting.id}`;
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h1 className="text-2xl font-bold">Meetings</h1>
        <button
          onClick={() => window.location.href = '/meeting/new'}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          + New Meeting
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {meetings.map((meeting) => (
          <div
            key={meeting.id}
            onClick={() => window.location.href = `/meeting/${meeting.id}`}
            className="p-4 border-b border-gray-200 hover:bg-gray-50 cursor-pointer"
          >
            <div className="font-semibold text-lg">{meeting.title}</div>
            <div className="text-sm text-gray-500">
              {new Date(meeting.date).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
      {showSearch && (
        <SearchDialog
          meetings={meetings}
          onSelect={handleMeetingSelect}
          onClose={() => setShowSearch(false)}
        />
      )}
    </div>
  );
}; 