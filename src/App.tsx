import React, { useState, useCallback, useEffect } from 'react';
import { Meeting, ActionItem } from './types';
import { MeetingList } from './components/MeetingList';
import { Editor } from './components/Editor';
import { ActionItems } from './components/ActionItems';

function App() {
  const [meetings, setMeetings] = useState<Meeting[]>(() => {
    const saved = localStorage.getItem('meetings');
    return saved ? JSON.parse(saved) : [];
  });

  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [actionItems, setActionItems] = useState<ActionItem[]>(() => {
    const saved = localStorage.getItem('actionItems');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('meetings', JSON.stringify(meetings));
  }, [meetings]);

  useEffect(() => {
    localStorage.setItem('actionItems', JSON.stringify(actionItems));
  }, [actionItems]);

  const handleNewMeeting = useCallback(() => {
    const newMeeting: Meeting = {
      id: Date.now().toString(),
      title: 'New Meeting',
      date: new Date().toLocaleDateString(),
      content: '',
    };
    setMeetings((prev) => [...prev, newMeeting]);
    setSelectedMeeting(newMeeting);
  }, []);

  const handleUpdateMeeting = useCallback((updatedMeeting: Meeting) => {
    setMeetings((prev) =>
      prev.map((m) => (m.id === updatedMeeting.id ? updatedMeeting : m))
    );
    setSelectedMeeting(updatedMeeting);

    // Extract action items from content
    const content = updatedMeeting.content;
    const aiRegex = /AI:\s*([^\n]+)/g;
    const matches = Array.from(content.matchAll(aiRegex));

    // Create new action items
    const newActionItems = matches.map((match) => ({
      id: `${updatedMeeting.id}-${Date.now()}-${match.index}`, // Add match.index for uniqueness
      text: match[1].trim(),
      completed: false,
      meetingId: updatedMeeting.id,
      createdAt: new Date().toISOString(),
    }));

    // Update action items, replacing existing ones for this meeting
    setActionItems((prev) => {
      const existing = prev.filter((ai) => ai.meetingId !== updatedMeeting.id);
      return [...existing, ...newActionItems];
    });
  }, []);

  const handleToggleActionItem = useCallback((id: string) => {
    setActionItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  }, []);

  return (
    <div className="flex h-screen bg-white">
      <MeetingList
        meetings={meetings}
        selectedMeeting={selectedMeeting}
        onSelectMeeting={setSelectedMeeting}
        onNewMeeting={handleNewMeeting}
      />
      <Editor meeting={selectedMeeting} onUpdate={handleUpdateMeeting} />
      <ActionItems
        items={actionItems.filter(item => item.meetingId === selectedMeeting?.id)}
        onToggleComplete={handleToggleActionItem}
      />
    </div>
  );
}

export default App;