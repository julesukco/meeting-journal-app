import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Meeting, ActionItem } from '../types';
import { MeetingList } from './MeetingList';
import { Editor } from './Editor';
import { RightNav } from './RightNav';
import { MeetingTabs } from './MeetingTabs';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MeetingViewProps {
  meetings: (Meeting & { isVirtual?: boolean; virtualId?: string; originalMeetingId?: string })[];
  selectedMeeting: Meeting | null;
  actionItems: ActionItem[];
  recentMeetings: Meeting[];
  onSelectMeeting: (meeting: Meeting & { isVirtual?: boolean; virtualId?: string; originalMeetingId?: string }) => void;
  onNewMeeting: () => void;
  onUpdateMeeting: (meeting: Meeting) => void;
  onReorderMeetings: (newOrder: Meeting[]) => void;
  onToggleActionItem: (id: string) => void;
  onExport: () => void;
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onArchiveMeeting?: (meetingId: string, isArchived: boolean) => void;
  processCompletedItems: (content: string) => string;
  createVirtualDuplicate: (meeting: Meeting) => void;
  removeVirtualDuplicate: (duplicateId: string) => void;
  updateVirtualDuplicateGroup: (duplicateId: string, newGroup: string, newSortOrder?: number) => void;
  handleItemReorder: (draggedId: string, newGroup: string, newSortOrder: number) => void;
}

export const MeetingView: React.FC<MeetingViewProps> = ({
  meetings,
  selectedMeeting,
  actionItems,
  recentMeetings,
  onSelectMeeting,
  onNewMeeting,
  onUpdateMeeting,
  onReorderMeetings,
  onToggleActionItem,
  onExport,
  onImport,
  onArchiveMeeting,
  processCompletedItems,
  createVirtualDuplicate,
  removeVirtualDuplicate,
  updateVirtualDuplicateGroup,
  handleItemReorder,
}) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [isLeftNavVisible, setIsLeftNavVisible] = useState(true);
  const [isRightNavVisible, setIsRightNavVisible] = useState(false);

  // Set selected meeting based on URL parameter
  useEffect(() => {
    if (id && meetings.length > 0) {
      const meeting = meetings.find(m => m.id === id);
      if (meeting && (!selectedMeeting || selectedMeeting.id !== id)) {
        onSelectMeeting(meeting);
      }
    }
  }, [id, meetings, selectedMeeting, onSelectMeeting]);

  const handleTabMeetingSelect = useCallback((meeting: Meeting) => {
    onSelectMeeting(meeting);
    navigate(`/meeting/${meeting.id}`);
  }, [onSelectMeeting, navigate]);

  const handleLeftNavMeetingSelect = useCallback((meeting: Meeting) => {
    onSelectMeeting(meeting);
    navigate(`/meeting/${meeting.id}`);
  }, [onSelectMeeting, navigate]);

  // Keyboard shortcut handler for nav toggles
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Check if we're not in an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      // Option+Left Arrow: Toggle left navigation
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        setIsLeftNavVisible((v) => !v);
      }
      
      // Option+Right Arrow: Toggle right navigation
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        setIsRightNavVisible((v) => !v);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <div className="flex h-screen">
      {isLeftNavVisible && (
        <div>
          <MeetingList
            meetings={meetings}
            selectedMeeting={selectedMeeting}
            onSelectMeeting={handleLeftNavMeetingSelect}
            onNewMeeting={onNewMeeting}
            onUpdateMeeting={onUpdateMeeting}
            onReorderMeetings={onReorderMeetings}
            createVirtualDuplicate={createVirtualDuplicate}
            removeVirtualDuplicate={removeVirtualDuplicate}
            updateVirtualDuplicateGroup={updateVirtualDuplicateGroup}
            handleItemReorder={handleItemReorder}
          />
        </div>
      )}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto">
        {/* Header row with nav toggles and meeting tabs */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-2 py-2 border-b border-gray-200 bg-white">
          <button
            onClick={() => setIsLeftNavVisible((v) => !v)}
            className="bg-white border border-gray-300 rounded-full p-1 shadow hover:bg-gray-100"
            title={isLeftNavVisible ? 'Hide left nav (⌘+←)' : 'Show left nav (⌘+←)'}
          >
            {isLeftNavVisible ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
          
          <div className="flex-1">
            <MeetingTabs
              currentMeeting={selectedMeeting}
              recentMeetings={recentMeetings}
              onSelectMeeting={handleTabMeetingSelect}
            />
          </div>
          
          <button
            onClick={() => setIsRightNavVisible((v) => !v)}
            className={`rounded-full p-1 shadow border ${selectedMeeting && actionItems.filter(item => item.meetingId === selectedMeeting.id && !item.completed).length > 0 ? 'bg-blue-500 border-blue-500 hover:bg-blue-600' : 'bg-white border-gray-300 hover:bg-gray-100'}`}
            title={isRightNavVisible ? 'Hide right nav (⌘+→)' : 'Show right nav (⌘+→)'}
          >
            {isRightNavVisible ? (
              <ChevronRight className={`w-5 h-5 ${selectedMeeting && actionItems.filter(item => item.meetingId === selectedMeeting.id && !item.completed).length > 0 ? 'text-white' : 'text-gray-700'}`} />
            ) : (
              <ChevronLeft className={`w-5 h-5 ${selectedMeeting && actionItems.filter(item => item.meetingId === selectedMeeting.id && !item.completed).length > 0 ? 'text-white' : 'text-gray-700'}`} />
            )}
          </button>
        </div>
        <Editor
          meeting={selectedMeeting}
          onUpdateMeeting={onUpdateMeeting}
          processCompletedItems={processCompletedItems}
        />
      </div>
      {isRightNavVisible && (
        <div className="h-screen overflow-y-auto">
          <RightNav
            actionItems={selectedMeeting ? actionItems.filter(item => item.meetingId === selectedMeeting.id) : []}
            onToggleActionItem={onToggleActionItem}
            onExport={onExport}
            onImport={onImport}
            selectedMeeting={selectedMeeting}
            onArchiveMeeting={onArchiveMeeting}
          />
        </div>
      )}
    </div>
  );
};