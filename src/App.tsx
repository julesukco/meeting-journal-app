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

    // Create new action items while preserving completed state
    setActionItems((prev) => {
      // Get existing items for other meetings
      const otherMeetingsItems = prev.filter((ai) => ai.meetingId !== updatedMeeting.id);
      
      // Create a map of existing items for the current meeting
      const existingItemsMap = prev
        .filter((ai) => ai.meetingId === updatedMeeting.id)
        .reduce((map, item) => {
          map[item.text.trim()] = item;
          return map;
        }, {} as Record<string, typeof prev[0]>);

      // Create or update action items
      const currentMeetingItems = matches.map((match) => {
        const text = match[1].trim();
        const existingItem = existingItemsMap[text];
        
        if (existingItem) {
          // Preserve the existing item with its completed state
          return existingItem;
        }

        // Create new item if it doesn't exist
        return {
          id: `${updatedMeeting.id}-${Date.now()}-${match.index}`,
          text: text,
          completed: false,
          meetingId: updatedMeeting.id,
          createdAt: new Date().toISOString(),
        };
      });

      return [...otherMeetingsItems, ...currentMeetingItems];
    });
  }, []);

  const handleToggleActionItem = useCallback((id: string) => {
    setActionItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  }, []);

  // For the strikethrough functionality, we need to modify how the content is displayed
  // in the Editor component. You'll need to update the Editor component to process
  // the content and add strikethrough styling for completed action items.
  const processCompletedItems = useCallback((content: string) => {
    if (!selectedMeeting) return content;
    
    const completedItems = actionItems.filter(
      (item) => item.meetingId === selectedMeeting.id && item.completed
    );

    let processedContent = content;
    completedItems.forEach((item) => {
      const regex = new RegExp(`AI:\\s*(${item.text})`, 'g');
      processedContent = processedContent.replace(regex, 'Done: $1');
    });

    return processedContent;
  }, [actionItems, selectedMeeting]);

  return (
    <div className="flex h-screen bg-white">
      <MeetingList
        meetings={meetings}
        selectedMeeting={selectedMeeting}
        onSelectMeeting={setSelectedMeeting}
        onNewMeeting={handleNewMeeting}
      />
      <Editor 
        meeting={selectedMeeting} 
        onUpdate={handleUpdateMeeting}
        processContent={processCompletedItems}
      />
      <ActionItems
        items={actionItems.filter(item => 
          item.meetingId === selectedMeeting?.id && !item.completed
        )}
        onToggleComplete={handleToggleActionItem}
      />
    </div>
  );
}

export default App;