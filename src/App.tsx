import React, { useState, useCallback, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Meeting, ActionItem } from './types';
import { MeetingList } from './components/MeetingList';
import { Editor } from './components/Editor';
import { ActionItems } from './components/ActionItems';
import { exportMeetings, importMeetings, getMeetings, saveMeetings } from './services/storage';
import { RightNav } from './components/RightNav';
import { SearchDialog } from './components/SearchDialog';
import { MeetingListScreen } from './screens/MeetingListScreen';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { get, set } from 'idb-keyval';

function App() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  
  // Load data from IndexedDB on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load meetings from IndexedDB
        const storedMeetings = await getMeetings();
        setMeetings(storedMeetings);
        
        // Load action items from IndexedDB
        const storedActionItems = await get('actionItems') || [];
        setActionItems(storedActionItems);
      } catch (error) {
        console.error('Error loading data from IndexedDB:', error);
      }
    };
    
    loadData();
  }, []);

  const [isLeftNavVisible, setIsLeftNavVisible] = useState(true);
  const [isRightNavVisible, setIsRightNavVisible] = useState(true);
  const [showSearch, setShowSearch] = useState(false);

  // Save meetings to IndexedDB whenever they change
  useEffect(() => {
    if (meetings.length > 0) {
      saveMeetings(meetings).catch(error => {
        console.error('Error saving meetings to IndexedDB:', error);
      });
    }
  }, [meetings]);

  // Save action items to IndexedDB whenever they change
  useEffect(() => {
    if (actionItems.length > 0) {
      set('actionItems', actionItems).catch(error => {
        console.error('Error saving action items to IndexedDB:', error);
      });
    }
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
    const now = Date.now();
    const newMeeting: Meeting = {
      id: now.toString(),
      title: 'New Meeting',
      date: new Date().toLocaleDateString(),
      content: '',
      notes: '',
      attendees: [],
      createdAt: now,
      updatedAt: now
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

  const handleReorderMeetings = (newOrder: Meeting[]) => {
    setMeetings(newOrder);
    saveMeetings(newOrder);
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
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      console.log('Importing data:', text.substring(0, 100) + '...');
      
      // Parse the imported data to check its structure
      const importedData = JSON.parse(text);
      console.log('Imported meetings count:', importedData.meetings?.length || 0);
      console.log('Imported action items count:', importedData.reminders?.length || 0);
      
      await importMeetings(text);
      
      // Load the imported data into state instead of reloading the page
      const importedMeetings = await getMeetings();
      setMeetings(importedMeetings);
      
      // Also update action items if they exist in the imported data
      if (importedData.actionItems) {
        setActionItems(importedData.actionItems);
      }
      
      // Clear the file input so the same file can be selected again
      event.target.value = '';
      
      alert('Import successful! Data has been loaded.');
    } catch (error) {
      console.error('Import error:', error);
      alert('Failed to import meetings: ' + (error instanceof Error ? error.message : 'Unknown error'));
      // Clear the file input even on error
      event.target.value = '';
    }
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={<MeetingListScreen />} />
        <Route
          path="/meeting/:id"
          element={
            <div className="flex h-screen">
              {isLeftNavVisible && (
                <div>
                  <MeetingList
                    meetings={meetings}
                    selectedMeeting={selectedMeeting}
                    onSelectMeeting={handleMeetingSelect}
                    onNewMeeting={handleNewMeeting}
                    onUpdateMeeting={handleUpdateMeeting}
                    onReorderMeetings={handleReorderMeetings}
                  />
                </div>
              )}
              <div className="flex-1 flex flex-col h-screen overflow-y-auto">
                {/* Header row with nav toggles and meeting title */}
                <div className="sticky top-0 z-10 flex items-center justify-between px-2 py-2 border-b border-gray-200 bg-white">
                  <button
                    onClick={() => setIsLeftNavVisible((v) => !v)}
                    className="bg-white border border-gray-300 rounded-full p-1 shadow hover:bg-gray-100"
                    title={isLeftNavVisible ? 'Hide left nav' : 'Show left nav'}
                  >
                    {isLeftNavVisible ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </button>
                  <div className="flex-1 text-center text-2xl font-bold truncate px-2">
                    {selectedMeeting ? selectedMeeting.title : ''}
                  </div>
                  <button
                    onClick={() => setIsRightNavVisible((v) => !v)}
                    className="bg-white border border-gray-300 rounded-full p-1 shadow hover:bg-gray-100"
                    title={isRightNavVisible ? 'Hide right nav' : 'Show right nav'}
                  >
                    {isRightNavVisible ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                  </button>
                </div>
                <Editor
                  meeting={selectedMeeting}
                  onUpdateMeeting={handleUpdateMeeting}
                  processCompletedItems={processCompletedItems}
                />
              </div>
              {isRightNavVisible && (
                <div className="h-screen overflow-y-auto">
                  <RightNav
                    actionItems={selectedMeeting ? actionItems.filter(item => item.meetingId === selectedMeeting.id) : []}
                    onToggleActionItem={toggleActionItem}
                    onExport={handleExport}
                    onImport={handleImport}
                    selectedMeeting={selectedMeeting}
                  />
                </div>
              )}
            </div>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {showSearch && (
        <SearchDialog
          meetings={meetings}
          onSelect={handleMeetingSelect}
          onClose={() => setShowSearch(false)}
        />
      )}
    </Router>
  );
}

export default App;