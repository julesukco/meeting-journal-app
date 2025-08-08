import React, { useState, useCallback, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Meeting, ActionItem, VirtualDuplicate } from './types';
import { MeetingList } from './components/MeetingList';
import { Editor } from './components/Editor';
import { ActionItems } from './components/ActionItems';
import { exportMeetings, importMeetings, getMeetings, saveMeetings } from './services/storage';
import { RightNav } from './components/RightNav';
import { SearchDialog } from './components/SearchDialog';
import { MeetingListScreen } from './screens/MeetingListScreen';
import { MeetingView } from './components/MeetingView';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { get, set } from 'idb-keyval';

function App() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [virtualDuplicates, setVirtualDuplicates] = useState<VirtualDuplicate[]>([]);
  const [isLeftNavVisible, setIsLeftNavVisible] = useState(true);
  const [isRightNavVisible, setIsRightNavVisible] = useState(false);
  const [recentMeetings, setRecentMeetings] = useState<any[]>([]); // Replace any[] with correct type if available
  const pendingMeetingUpdateRef = React.useRef<Meeting | null>(null);
  const saveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  
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
        
        // Load virtual duplicates from IndexedDB
        const storedVirtualDuplicates = await get('virtualDuplicates') || [];
        setVirtualDuplicates(storedVirtualDuplicates);
        
        // Load recent meetings from IndexedDB
        const storedRecentMeetings = await get('recentMeetings') || [];
        setRecentMeetings(storedRecentMeetings);
      } catch (error) {
        console.error('Error loading data from IndexedDB:', error);
      }
    };
    
    loadData();
  }, []);

  const [showSearch, setShowSearch] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState<number>(0);

  // Debounced save function
  const debouncedSave = useCallback((meetingToSave: Meeting) => {
    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Store the pending update
    pendingMeetingUpdateRef.current = meetingToSave;
    
    // Set a new timeout to save after 1 second of inactivity
    saveTimeoutRef.current = setTimeout(async () => {
      if (pendingMeetingUpdateRef.current) {
        try {
          const startTime = performance.now();
          
          // Update the meetings state with the pending update
          setMeetings((prev) =>
            prev.map((m) => (m.id === pendingMeetingUpdateRef.current!.id ? pendingMeetingUpdateRef.current! : m))
          );
          
          // Save to IndexedDB
          const currentMeetings = await getMeetings();
          const updatedMeetings = currentMeetings.map((m) => 
            m.id === pendingMeetingUpdateRef.current!.id ? pendingMeetingUpdateRef.current! : m
          );
          await saveMeetings(updatedMeetings);
          
          const endTime = performance.now();
          const saveTime = endTime - startTime;
          setLastSaveTime(saveTime);
          
          // Log performance metrics
          console.log(`Save completed in ${saveTime.toFixed(2)}ms`);
          
          // Clear the pending update
          pendingMeetingUpdateRef.current = null;
        } catch (error) {
          console.error('Error saving meeting to IndexedDB:', error);
        }
      }
    }, 1000); // 1 second debounce
  }, []);

  // Save meetings to IndexedDB whenever they change (only for non-debounced updates)
  useEffect(() => {
    if (meetings.length > 0 && !pendingMeetingUpdateRef.current) {
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

  // Save virtual duplicates to IndexedDB whenever they change
  useEffect(() => {
    if (virtualDuplicates.length > 0) {
      set('virtualDuplicates', virtualDuplicates).catch(error => {
        console.error('Error saving virtual duplicates to IndexedDB:', error);
      });
    }
  }, [virtualDuplicates]);

  // Function to create a virtual duplicate
  const createVirtualDuplicate = useCallback((meeting: Meeting) => {
    const now = Date.now();
    const virtualDuplicate: VirtualDuplicate = {
      id: `virtual-${meeting.id}-${now}`,
      originalMeetingId: meeting.id,
      displayTitle: `${meeting.title} (Copy)`,
      group: meeting.group,
      sortOrder: now, // Use timestamp as initial sort order
      createdAt: now
    };
    
    setVirtualDuplicates(prev => [...prev, virtualDuplicate]);
  }, []);

  // Function to remove a virtual duplicate
  const removeVirtualDuplicate = useCallback((duplicateId: string) => {
    setVirtualDuplicates(prev => prev.filter(d => d.id !== duplicateId));
  }, []);

  // Function to update a virtual duplicate's group and sort order
  const updateVirtualDuplicateGroup = useCallback((duplicateId: string, newGroup: string, newSortOrder?: number) => {
    setVirtualDuplicates(prev => {
      const updated = prev.map(d => 
        d.id === duplicateId 
          ? { ...d, group: newGroup || undefined, sortOrder: newSortOrder !== undefined ? newSortOrder : d.sortOrder }
          : d
      );
      
      // Debug logging for virtual duplicate updates
      if (duplicateId.startsWith('virtual-')) {
        const updatedItem = updated.find(d => d.id === duplicateId);
        console.log('Virtual duplicate updated:', {
          duplicateId,
          newGroup,
          newSortOrder,
          updatedItem
        });
      }
      
      return updated;
    });
  }, []);

  // Function to handle reordering of all items (meetings and virtual duplicates)
  const handleItemReorder = useCallback((draggedId: string, newGroup: string, newSortOrder: number) => {
    const isVirtual = draggedId.startsWith('virtual-');
    
    if (isVirtual) {
      updateVirtualDuplicateGroup(draggedId, newGroup, newSortOrder);
    } else {
      // Update real meeting
      setMeetings(prev => prev.map(m => 
        m.id === draggedId 
          ? { ...m, group: newGroup || undefined, sortOrder: newSortOrder, updatedAt: Date.now() }
          : m
      ));
    }
  }, [updateVirtualDuplicateGroup]);

  // Function to get the original meeting from a virtual duplicate
  const getOriginalMeeting = useCallback((duplicateId: string): Meeting | null => {
    const duplicate = virtualDuplicates.find(d => d.id === duplicateId);
    if (!duplicate) return null;
    return meetings.find(m => m.id === duplicate.originalMeetingId) || null;
  }, [virtualDuplicates, meetings]);

  // Function to get all meetings including virtual duplicates for display
  const getDisplayMeetings = useCallback((): (Meeting & { isVirtual?: boolean; virtualId?: string; originalMeetingId?: string })[] => {
    const displayMeetings: (Meeting & { isVirtual?: boolean; virtualId?: string; originalMeetingId?: string })[] = [];
    
    // Add real meetings with sort order (use createdAt if no sortOrder)
    meetings.forEach(meeting => {
      displayMeetings.push({
        ...meeting,
        sortOrder: meeting.sortOrder || meeting.createdAt
      });
    });
    
    // Add virtual duplicates
    virtualDuplicates.forEach(duplicate => {
      const originalMeeting = meetings.find(m => m.id === duplicate.originalMeetingId);
      if (originalMeeting) {
        displayMeetings.push({
          ...originalMeeting,
          id: duplicate.id, // Use virtual ID for selection
          title: duplicate.displayTitle,
          group: duplicate.group, // Use the virtual duplicate's group
          sortOrder: duplicate.sortOrder,
          isVirtual: true,
          virtualId: duplicate.id,
          originalMeetingId: duplicate.originalMeetingId
        });
      }
    });
    
    // Sort by sortOrder, falling back to createdAt for consistent ordering
    return displayMeetings.sort((a, b) => {
      const aSortOrder = a.sortOrder || a.createdAt;
      const bSortOrder = b.sortOrder || b.createdAt;
      return aSortOrder - bSortOrder;
    });
  }, [meetings, virtualDuplicates]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Global keyboard shortcut handler
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Check if we're not in an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      // Backslash: Show search dialog
      if (e.key === '\\') {
        e.preventDefault();
        setShowSearch(true);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const updateRecentMeetings = useCallback((newMeeting: Meeting) => {
    setRecentMeetings((prev) => {
      // If there's a currently selected meeting, add it to recent meetings
      const toAdd = selectedMeeting ? [selectedMeeting] : [];
      // Remove the new meeting if it's already in the list
      const filtered = prev.filter(m => m.id !== newMeeting.id);
      // Combine, remove any currently selected meeting from recent, and keep only the last 2
      const updated = [...toAdd, ...filtered].slice(0, 2);
      // Save to IndexedDB
      set('recentMeetings', updated).catch(error => {
        console.error('Error saving recent meetings to IndexedDB:', error);
      });
      return updated;
    });
  }, [selectedMeeting]);

  // Function to handle meeting selection (works with both real and virtual meetings)
  const handleMeetingSelect = useCallback((meeting: Meeting & { isVirtual?: boolean; virtualId?: string; originalMeetingId?: string }) => {
    setShowSearch(false);
    
    if (meeting.isVirtual) {
      // For virtual meetings, find and select the original meeting
      const originalMeeting = meetings.find(m => m.id === meeting.originalMeetingId);
      if (originalMeeting) {
        if (!selectedMeeting || selectedMeeting.id !== originalMeeting.id) {
          updateRecentMeetings(originalMeeting);
        }
        setSelectedMeeting(originalMeeting);
      }
    } else {
      // For real meetings, proceed as normal
      if (!selectedMeeting || selectedMeeting.id !== meeting.id) {
        updateRecentMeetings(meeting);
      }
      setSelectedMeeting(meeting);
    }
  }, [selectedMeeting, meetings, updateRecentMeetings]);

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
    // Update the selected meeting immediately for UI responsiveness
    setSelectedMeeting(updatedMeeting);
    
    // Use debounced save for the meeting content
    debouncedSave(updatedMeeting);

    // Extract action items from HTML content (debounced to avoid performance issues)
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
  }, [debouncedSave]);

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
            <MeetingView
              meetings={getDisplayMeetings()}
              selectedMeeting={selectedMeeting}
              actionItems={actionItems}
              recentMeetings={recentMeetings}
              onSelectMeeting={handleMeetingSelect}
              onNewMeeting={handleNewMeeting}
              onUpdateMeeting={handleUpdateMeeting}
              onReorderMeetings={handleReorderMeetings}
              onToggleActionItem={toggleActionItem}
              onExport={handleExport}
              onImport={handleImport}
              processCompletedItems={processCompletedItems}
              createVirtualDuplicate={createVirtualDuplicate}
              removeVirtualDuplicate={removeVirtualDuplicate}
              updateVirtualDuplicateGroup={updateVirtualDuplicateGroup}
              handleItemReorder={handleItemReorder}
            />
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