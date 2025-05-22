import React, { useState, useEffect, useRef } from 'react';
import { CalendarDays, Plus, ArrowUp, ArrowDown, ChevronDown, ChevronRight, FolderPlus } from 'lucide-react';
import { Meeting } from '../types';

interface MeetingListProps {
  meetings: Meeting[];
  selectedMeeting: Meeting | null;
  onSelectMeeting: (meeting: Meeting) => void;
  onNewMeeting: () => void;
  onReorderMeeting?: (meetingId: string, direction: 'up' | 'down') => void;
  onUpdateMeeting: (meeting: Meeting) => void;
}

export function MeetingList({
  meetings,
  selectedMeeting,
  onSelectMeeting,
  onNewMeeting,
  onReorderMeeting,
  onUpdateMeeting,
}: MeetingListProps) {
  const EXPANDED_KEY = 'expandedMeetingGroups';
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const saved = localStorage.getItem(EXPANDED_KEY);
    if (saved) {
      try {
        return new Set(JSON.parse(saved));
      } catch {
        return new Set(['']);
      }
    }
    return new Set(['']);
  });

  // Persist expandedGroups to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(EXPANDED_KEY, JSON.stringify(Array.from(expandedGroups)));
  }, [expandedGroups]);

  const [newGroupName, setNewGroupName] = useState('');
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const GROUPS_KEY = 'meetingGroups';
  const [groups, setGroups] = useState<string[]>(() => {
    const saved = localStorage.getItem(GROUPS_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  // Sync groups to localStorage
  useEffect(() => {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
  }, [groups]);

  // When meetings change, add any new group names from meetings
  useEffect(() => {
    const meetingGroups = Array.from(new Set(meetings.map(m => m.group).filter((g): g is string => typeof g === 'string' && g.trim() !== '')));
    setGroups(prev => Array.from(new Set([...prev, ...meetingGroups])));
  }, [meetings]);

  // Group meetings by their group property
  const groupedMeetings = meetings.reduce((acc, meeting) => {
    const group = meeting.group || '';
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(meeting);
    return acc;
  }, {} as Record<string, Meeting[]>);

  // Move group up or down
  const moveGroup = (group: string, direction: 'up' | 'down') => {
    const idx = groups.indexOf(group);
    if (idx === -1) return;
    let newGroups = [...groups];
    if (direction === 'up' && idx > 0) {
      [newGroups[idx], newGroups[idx - 1]] = [newGroups[idx - 1], newGroups[idx]];
    } else if (direction === 'down' && idx < newGroups.length - 1) {
      [newGroups[idx], newGroups[idx + 1]] = [newGroups[idx + 1], newGroups[idx]];
    }
    setGroups(newGroups);
  };

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  const handleNewGroup = () => {
    if (newGroupName.trim() && !groups.includes(newGroupName.trim())) {
      setGroups(prev => [...prev, newGroupName.trim()]);
      setExpandedGroups(prev => new Set([...prev, newGroupName.trim()]));
    }
    setNewGroupName('');
    setShowNewGroupInput(false);
  };

  // Helper to get the previous and next group
  const getAdjacentGroups = (group: string) => {
    const idx = groups.indexOf(group);
    return {
      prev: idx > 0 ? groups[idx - 1] : null,
      next: idx < groups.length - 1 ? groups[idx + 1] : null,
    };
  };

  // Custom reorder handler for cross-group movement
  const handleReorder = (meeting: Meeting, direction: 'up' | 'down', index: number, group: string) => {
    const { prev, next } = getAdjacentGroups(group);
    if (direction === 'up' && index === 0 && prev !== null) {
      // Move to end of previous group
      onUpdateMeeting({ ...meeting, group: prev || undefined });
      return;
    }
    if (
      direction === 'down' &&
      groupedMeetings[group] &&
      index === groupedMeetings[group].length - 1 &&
      next !== null
    ) {
      // Move to start of next group
      onUpdateMeeting({ ...meeting, group: next || undefined });
      return;
    }
    // Otherwise, use the normal reorder
    if (onReorderMeeting) {
      onReorderMeeting(meeting.id, direction);
    }
  };

  // Render ungrouped first, then groups in the order of the groups array
  const allGroups = [''].concat(groups);
  const sortedGroups = allGroups;

  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingMeetingId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingMeetingId]);

  return (
    <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col h-screen">
      <div className="flex items-center justify-between p-2 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-700">Meetings</h2>
        <div className="flex gap-1">
          <button
            onClick={() => setShowNewGroupInput(true)}
            className="p-1 hover:bg-gray-200 rounded-full transition-colors"
            title="New Group"
          >
            <FolderPlus className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={onNewMeeting}
            className="p-1 hover:bg-gray-200 rounded-full transition-colors"
            title="New Meeting"
          >
            <Plus className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {showNewGroupInput && (
        <div className="p-2 border-b border-gray-200">
          <div className="flex gap-1">
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="New group name..."
              className="flex-1 px-2 py-1 text-sm border rounded"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleNewGroup();
                } else if (e.key === 'Escape') {
                  setShowNewGroupInput(false);
                  setNewGroupName('');
                }
              }}
            />
            <button
              onClick={handleNewGroup}
              className="px-2 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Add
            </button>
          </div>
        </div>
      )}

      <div className="overflow-y-auto flex-1">
        {sortedGroups.map((group) => (
          <div key={group || 'ungrouped'}>
            {group && (
              <div
                className="flex items-center px-3 py-2 bg-blue-100 border-l-4 border-blue-500 cursor-pointer hover:bg-blue-200 shadow-sm mb-1"
                onClick={() => toggleGroup(group)}
              >
                {expandedGroups.has(group) ? (
                  <ChevronDown className="w-4 h-4 text-blue-700" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-blue-700" />
                )}
                <span className="ml-2 text-base font-bold text-blue-800 tracking-wide uppercase flex-1">{group}</span>
                {/* Group move up/down buttons */}
                <button
                  onClick={e => { e.stopPropagation(); moveGroup(group, 'up'); }}
                  disabled={groups.indexOf(group) === 0}
                  className={`p-1 rounded ${groups.indexOf(group) === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-blue-700 hover:bg-blue-200'}`}
                  title="Move group up"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); moveGroup(group, 'down'); }}
                  disabled={groups.indexOf(group) === groups.length - 1}
                  className={`p-1 rounded ${groups.indexOf(group) === groups.length - 1 ? 'text-gray-300 cursor-not-allowed' : 'text-blue-700 hover:bg-blue-200'}`}
                  title="Move group down"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              </div>
            )}
            {expandedGroups.has(group) && (groupedMeetings[group] || []).map((meeting, index) => (
              <div
                key={meeting.id}
                className={`px-2 py-1.5 border-b border-gray-100 cursor-pointer ${
                  selectedMeeting?.id === meeting.id
                    ? 'bg-blue-50'
                    : 'hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-1">
                  <div 
                    className="text-sm text-gray-800 flex-1 truncate cursor-pointer"
                    onDoubleClick={() => {
                      setEditingMeetingId(meeting.id);
                      setEditingTitle(meeting.title);
                    }}
                    onClick={() => onSelectMeeting(meeting)}
                  >
                    {editingMeetingId === meeting.id ? (
                      <input
                        ref={inputRef}
                        type="text"
                        value={editingTitle}
                        onChange={e => setEditingTitle(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            if (editingTitle.trim() && editingTitle !== meeting.title) {
                              onUpdateMeeting({ ...meeting, title: editingTitle.trim() });
                            }
                            setEditingMeetingId(null);
                            // Focus the editor after updating the title
                            const editorElement = document.querySelector('.ProseMirror');
                            if (editorElement) {
                              (editorElement as HTMLElement).focus();
                            }
                          } else if (e.key === 'Escape') {
                            setEditingMeetingId(null);
                          }
                        }}
                        onBlur={() => {
                          if (editingTitle.trim() && editingTitle !== meeting.title) {
                            onUpdateMeeting({ ...meeting, title: editingTitle.trim() });
                          }
                          setEditingMeetingId(null);
                          // Focus the editor after updating the title
                          const editorElement = document.querySelector('.ProseMirror');
                          if (editorElement) {
                            (editorElement as HTMLElement).focus();
                          }
                        }}
                        className="w-full px-1 py-0.5 border border-blue-300 rounded text-sm"
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      meeting.title
                    )}
                  </div>
                  {onReorderMeeting && (
                    <div className="flex flex-col ml-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReorder(meeting, 'up', index, group);
                        }}
                        disabled={index === 0 && sortedGroups.indexOf(group) === 0}
                        className={`p-0.5 rounded ${
                          index === 0 && sortedGroups.indexOf(group) === 0
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-500 hover:bg-gray-200'
                        }`}
                        title="Move up"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReorder(meeting, 'down', index, group);
                        }}
                        disabled={
                          index === (groupedMeetings[group]?.length || 0) - 1 &&
                          sortedGroups.indexOf(group) === sortedGroups.length - 1
                        }
                        className={`p-0.5 rounded ${
                          index === (groupedMeetings[group]?.length || 0) - 1 &&
                          sortedGroups.indexOf(group) === sortedGroups.length - 1
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-500 hover:bg-gray-200'
                        }`}
                        title="Move down"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}