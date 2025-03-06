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

    // Extract action items from HTML content
    const content = updatedMeeting.content;
    // This regex looks for "AI:" followed by text, even within HTML tags
    const aiRegex = /AI:\s*([^<]+)/g;
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

  const toggleActionItem = useCallback((id: string) => {
    setActionItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            completed: !item.completed,
            // Add or remove the completedAt date based on the completed state
            completedAt: !item.completed ? new Date().toISOString() : undefined
          };
        }
        return item;
      })
    );
  }, []);

  // Update the processCompletedItems function to include the completion date
  const processCompletedItems = useCallback((content: string) => {
    if (!selectedMeeting) return content;
    
    const completedItems = actionItems.filter(
      (item) => item.meetingId === selectedMeeting.id && item.completed
    );

    let processedContent = content;
    completedItems.forEach((item) => {
      // Escape special regex characters in the item text
      const escapedText = item.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Create a regex that can match the text in HTML content
      const regex = new RegExp(`(AI:\\s*)(${escapedText})`, 'g');
      
      // Get the completion date - either from the item or use current date
      const completionDate = item.completedAt 
        ? new Date(item.completedAt) 
        : new Date();
      
      // Format the date as MM/DD/YY
      const formattedDate = `${completionDate.getMonth() + 1}/${completionDate.getDate()}/${String(completionDate.getFullYear()).slice(2)}`;
      
      // Replace with "Done [date]:"
      processedContent = processedContent.replace(regex, `Done ${formattedDate}: $2`);
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
        onToggleComplete={toggleActionItem}
      />
    </div>
  );
}

export default App;