import React, { useState, useCallback, useEffect } from 'react';
import { Meeting, ActionItem } from './types';
import { MeetingList } from './components/MeetingList';
import { Editor } from './components/Editor';
import { ActionItems } from './components/ActionItems';
import { exportMeetings, importMeetings } from './services/storage';
import { RightNav } from './components/RightNav';
import { SearchDialog } from './components/SearchDialog';

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

  const [isLeftNavVisible, setIsLeftNavVisible] = useState(true);
  const [isRightNavVisible, setIsRightNavVisible] = useState(true);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    localStorage.setItem('meetings', JSON.stringify(meetings));
  }, [meetings]);

  useEffect(() => {
    localStorage.setItem('actionItems', JSON.stringify(actionItems));
  }, [actionItems]);

  // Global keyboard shortcut handler
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Check if we're not in an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      if (e.key === '\\') {
        e.preventDefault();
        setShowSearch(true);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const handleMeetingSelect = (meeting: Meeting) => {
    setShowSearch(false);
    setSelectedMeeting(meeting);
  };

  const handleNewMeeting = useCallback(() => {
    const newMeeting: Meeting = {
      id: Date.now().toString(),
      title: 'New Meeting',
      date: new Date().toLocaleDateString(),
      content: '',
      notes: '',
      attendees: []
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

  const handleReorderMeeting = (meetingId: string, direction: 'up' | 'down') => {
    const meetingIndex = meetings.findIndex(m => m.id === meetingId);
    if (meetingIndex === -1) return;
    
    const newMeetings = [...meetings];
    
    if (direction === 'up' && meetingIndex > 0) {
      // Swap with the previous meeting
      [newMeetings[meetingIndex], newMeetings[meetingIndex - 1]] = 
      [newMeetings[meetingIndex - 1], newMeetings[meetingIndex]];
    } else if (direction === 'down' && meetingIndex < meetings.length - 1) {
      // Swap with the next meeting
      [newMeetings[meetingIndex], newMeetings[meetingIndex + 1]] = 
      [newMeetings[meetingIndex + 1], newMeetings[meetingIndex]];
    }
    
    setMeetings(newMeetings);
  };

  const handleExport = async () => {
    try {
      const jsonString = await exportMeetings();
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'meetings.json';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('Failed to export meetings');
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          await importMeetings(content);
          alert('Meetings imported successfully');
          // Optionally reload meetings here if needed
        } catch {
          alert('Failed to import meetings');
        }
      };
      reader.readAsText(file);
    } catch {
      alert('Failed to import meetings');
    }
  };

  return (
    <div className="flex h-screen">
      {/* Left Navigation */}
      <div className={`transition-all duration-300 overflow-hidden bg-white border-r border-gray-200 ${isLeftNavVisible ? 'w-64' : 'w-0'}`}>
        {isLeftNavVisible && (
          <MeetingList
            meetings={meetings}
            selectedMeeting={selectedMeeting}
            onSelectMeeting={setSelectedMeeting}
            onNewMeeting={handleNewMeeting}
            onReorderMeeting={handleReorderMeeting}
          />
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1">
        <Editor
          meeting={selectedMeeting}
          onUpdate={handleUpdateMeeting}
          processContent={processCompletedItems}
          onToggleLeftNav={() => setIsLeftNavVisible(!isLeftNavVisible)}
          onToggleRightNav={() => setIsRightNavVisible(!isRightNavVisible)}
          isLeftNavVisible={isLeftNavVisible}
          isRightNavVisible={isRightNavVisible}
        />
      </div>

      {/* Right Navigation */}
      <RightNav
        isVisible={isRightNavVisible}
        actionItems={actionItems.filter(item =>
          item.meetingId === selectedMeeting?.id && !item.completed
        )}
        selectedMeetingId={selectedMeeting?.id}
        onToggleComplete={toggleActionItem}
        onMeetingsImported={() => {
          const saved = localStorage.getItem('meetings');
          setMeetings(saved ? JSON.parse(saved) : []);
        }}
      />

      {/* Search Dialog */}
      {showSearch && (
        <SearchDialog
          meetings={meetings}
          onSelect={handleMeetingSelect}
          onClose={() => setShowSearch(false)}
        />
      )}
    </div>
  );
}

export default App;