import React, { useState, useEffect } from 'react';
import { Meeting } from '../types';
import { getMeetings, saveMeetings as saveMeetingsToStorage } from '../services/storage';
import { SearchDialog } from '../components/SearchDialog';
import { MeetingList } from '../components/MeetingList';
import { useNavigate } from 'react-router-dom';

export function MeetingListScreen() {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

  useEffect(() => {
    loadMeetings();
  }, []);

  const loadMeetings = async () => {
    const storedMeetings = await getMeetings();
    setMeetings(storedMeetings);
  };

  const handleMeetingSelect = (meeting: Meeting) => {
    setShowSearch(false);
    setSelectedMeeting(meeting);
    navigate(`/meeting/${meeting.id}`);
  };

  const handleUpdateMeeting = async (meeting: Meeting) => {
    const updatedMeetings = [...meetings];
    const index = updatedMeetings.findIndex(m => m.id === meeting.id);
    if (index === -1) {
      updatedMeetings.push(meeting);
    } else {
      updatedMeetings[index] = meeting;
    }
    setMeetings(updatedMeetings);
    await saveMeetings(updatedMeetings);
  };

  const handleSelectMeeting = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    navigate(`/meeting/${meeting.id}`);
  };

  const handleNewMeeting = () => {
    navigate('/meeting/new');
  };

  const handleReorderMeeting = async (meetingId: string, direction: 'up' | 'down') => {
    const updatedMeetings = [...meetings];
    const index = updatedMeetings.findIndex(m => m.id === meetingId);
    if (index === -1) return;

    if (direction === 'up' && index > 0) {
      [updatedMeetings[index], updatedMeetings[index - 1]] = [updatedMeetings[index - 1], updatedMeetings[index]];
    } else if (direction === 'down' && index < updatedMeetings.length - 1) {
      [updatedMeetings[index], updatedMeetings[index + 1]] = [updatedMeetings[index + 1], updatedMeetings[index]];
    }

    setMeetings(updatedMeetings);
    await saveMeetings(updatedMeetings);
  };

  const saveMeetings = async (meetingsToSave: Meeting[]) => {
    try {
      await saveMeetingsToStorage(meetingsToSave);
    } catch (error) {
      console.error('Failed to save meetings:', error);
      // You might want to show an error message to the user here
    }
  };

  return (
    <div className="flex h-screen">
      <MeetingList
        meetings={meetings}
        selectedMeeting={selectedMeeting}
        onSelectMeeting={handleSelectMeeting}
        onNewMeeting={handleNewMeeting}
        onReorderMeeting={handleReorderMeeting}
        onUpdateMeeting={handleUpdateMeeting}
      />
      <div className="flex flex-col h-screen bg-white">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold">Meetings</h1>
          <button
            onClick={handleNewMeeting}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            + New Meeting
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {meetings.map((meeting) => (
            <div
              key={meeting.id}
              onClick={() => navigate(`/meeting/${meeting.id}`)}
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
    </div>
  );
} 