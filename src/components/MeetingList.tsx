import React, { useState, useEffect, useRef } from 'react';
import { CalendarDays, Plus, ArrowUp, ArrowDown, ChevronDown, ChevronRight, FolderPlus, GripVertical, Tag, Copy } from 'lucide-react';
import { Meeting } from '../types';
import { DragDropContext, Droppable, Draggable, DropResult, DraggableProvided, DraggableStateSnapshot, DroppableProvided } from 'react-beautiful-dnd';
import { get, set } from 'idb-keyval';

interface MeetingListProps {
  meetings: (Meeting & { isVirtual?: boolean; virtualId?: string; originalMeetingId?: string })[];
  selectedMeeting: Meeting | null;
  onSelectMeeting: (meeting: Meeting & { isVirtual?: boolean; virtualId?: string; originalMeetingId?: string }) => void;
  onNewMeeting: () => void;
  onReorderMeeting?: (meetingId: string, direction: 'up' | 'down') => void;
  onUpdateMeeting: (meeting: Meeting) => void;
  onReorderMeetings?: (newOrder: Meeting[]) => void;
  createVirtualDuplicate?: (meeting: Meeting) => void;
  removeVirtualDuplicate?: (duplicateId: string) => void;
}

export function MeetingList({
  meetings,
  selectedMeeting,
  onSelectMeeting,
  onNewMeeting,
  onReorderMeeting,
  onUpdateMeeting,
  onReorderMeetings,
  createVirtualDuplicate,
  removeVirtualDuplicate,
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
  const [groups, setGroups] = useState<string[]>([]);

  // Load groups from IndexedDB on mount
  useEffect(() => {
    const loadGroups = async () => {
      const savedGroups = await get(GROUPS_KEY);
      if (savedGroups) {
        setGroups(savedGroups);
      }
    };
    loadGroups();
  }, []);

  // Sync groups to IndexedDB
  useEffect(() => {
    if (groups.length > 0) {
      set(GROUPS_KEY, groups).catch(error => {
        console.error('Error saving groups to IndexedDB:', error);
      });
    }
  }, [groups]);

  // When meetings change, add any new group names from meetings
  useEffect(() => {
    const meetingGroups = Array.from(new Set(meetings.map(m => m.group).filter((g): g is string => typeof g === 'string' && g.trim() !== '')));
    setGroups(prev => Array.from(new Set([...prev, ...meetingGroups])));
  }, [meetings]);

  // Group meetings by their group
  const groupedMeetings = meetings.reduce((acc, meeting) => {
    const group = meeting.group || '';
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(meeting);
    return acc;
  }, {} as Record<string, (Meeting & { isVirtual?: boolean; virtualId?: string; originalMeetingId?: string })[]>);

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

  // Handle adding a new divider
  const handleNewDivider = () => {
    const now = Date.now();
    const newDivider: Meeting = {
      id: `divider-${now}`,
      title: 'New Divider',
      date: new Date().toLocaleDateString(),
      content: '',
      notes: '',
      attendees: [],
      createdAt: now,
      updatedAt: now,
      isDivider: true,
      group: '' // Add to ungrouped section by default
    };
    
    if (onReorderMeetings) {
      const newMeetings = [...meetings, newDivider];
      onReorderMeetings(newMeetings);
    }
  };

  // Handle drag end for meetings
  const onDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    
    const [sourceGroup, destGroup] = [source.droppableId, destination.droppableId];
    if (sourceGroup === destGroup && source.index === destination.index) return;

    // Create a new array of meetings
    const newMeetings = [...meetings];
    
    // Find the meeting being moved by its ID
    const meetingIndex = newMeetings.findIndex(m => m.id === draggableId);
    if (meetingIndex === -1) return;

    // Remove the meeting from its current position
    const [movedMeeting] = newMeetings.splice(meetingIndex, 1);
    
    // Calculate the absolute index in the full array
    let absoluteIndex = 0;
    let currentGroup = '';
    let itemsInCurrentGroup = 0;

    // If destination is ungrouped, we need to handle it specially
    if (destGroup === 'ungrouped') {
      if (destination.index === 0) {
        // If we're adding to the first position, always insert at the start
        absoluteIndex = 0;
      } else {
        // Find the first meeting that has a group
        const firstGroupedMeeting = newMeetings.find(m => m.group);
        if (firstGroupedMeeting) {
          absoluteIndex = newMeetings.indexOf(firstGroupedMeeting);
        } else {
          absoluteIndex = newMeetings.length;
        }
        // Find the correct position within ungrouped
        let ungroupedCount = 0;
        for (let i = 0; i < absoluteIndex; i++) {
          if (!newMeetings[i].group) {
            ungroupedCount++;
            if (ungroupedCount === destination.index) {
              absoluteIndex = i + 1;
              break;
            }
          }
        }
      }
    } else {
      // Handle regular groups as before
      let found = false;
      for (let i = 0; i < newMeetings.length; i++) {
        const currentMeeting = newMeetings[i];
        // If we're starting a new group
        if (currentMeeting.group !== currentGroup) {
          currentGroup = currentMeeting.group || 'ungrouped';
          itemsInCurrentGroup = 0;
        }
        // If we've found the destination group and reached the target index
        if (currentGroup === destGroup && itemsInCurrentGroup === destination.index) {
          absoluteIndex = i;
          found = true;
          break;
        }
        itemsInCurrentGroup++;
      }
      // If group is empty or we haven't found the position (e.g., adding to end of group)
      if (!found) {
        // Find the index of the first meeting in the next group after destGroup
        const nextGroupIndex = newMeetings.findIndex(m => {
          return m.group && groups.indexOf(m.group) > groups.indexOf(destGroup);
        });
        if (nextGroupIndex !== -1) {
          absoluteIndex = nextGroupIndex;
        } else {
          absoluteIndex = newMeetings.length;
        }
      }
    }

    // Update the meeting's group
    const updatedMeeting = {
      ...movedMeeting,
      group: destGroup === 'ungrouped' ? undefined : destGroup,
      updatedAt: Date.now()
    };

    // Insert the meeting at the calculated position
    newMeetings.splice(absoluteIndex, 0, updatedMeeting);

    // Call onReorderMeetings with the new order
    if (onReorderMeetings) {
      onReorderMeetings(newMeetings);
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
    <div className="w-72 h-screen bg-gray-50 border-r border-gray-200 flex flex-col overflow-y-auto overflow-x-visible">
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
            onClick={handleNewDivider}
            className="p-1 hover:bg-gray-200 rounded-full transition-colors"
            title="New Divider"
          >
            <Tag className="w-4 h-4 text-gray-600" />
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

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 overflow-y-auto">
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
              {expandedGroups.has(group) && (
                <div className="space-y-1">
                  <Droppable key={group || 'ungrouped'} droppableId={group || 'ungrouped'}>
                    {(provided: DroppableProvided) => (
                      <div ref={provided.innerRef} {...provided.droppableProps}>
                        {(groupedMeetings[group] || []).map((meeting: Meeting & { isVirtual?: boolean; virtualId?: string; originalMeetingId?: string }, index) => (
                          <Draggable key={meeting.id} draggableId={meeting.id} index={index}>
                            {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`px-2 py-1 cursor-pointer flex items-center gap-1 ${
                                  meeting.isDivider 
                                    ? 'text-[11px] font-semibold text-blue-700 bg-blue-50 rounded-md'
                                    : selectedMeeting?.id === meeting.id
                                      ? 'bg-blue-50'
                                      : 'hover:bg-gray-100 border-b border-gray-100'
                                } ${snapshot.isDragging ? 'bg-yellow-50' : ''}`}
                              >
                                <span {...provided.dragHandleProps} className="cursor-grab text-gray-400 hover:text-gray-600 flex-shrink-0">
                                  <GripVertical size={meeting.isDivider ? 12 : 16} />
                                </span>
                                <div
                                  className="text-sm text-gray-800 flex-1 cursor-pointer flex items-center gap-2"
                                  style={meeting.isDivider ? { fontSize: '10px' } : {}}
                                  onDoubleClick={() => {
                                    setEditingMeetingId(meeting.id);
                                    setEditingTitle(meeting.title);
                                  }}
                                  onClick={() => !meeting.isDivider && onSelectMeeting(meeting)}
                                >
                                  <span className="truncate">
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
                                          const editorElement = document.querySelector('.ProseMirror');
                                          if (editorElement) {
                                            (editorElement as HTMLElement).focus();
                                          }
                                        }}
                                        className="px-1 py-0.5 border border-blue-300 rounded text-sm min-w-0"
                                        onClick={e => e.stopPropagation()}
                                      />
                                    ) : (
                                      meeting.title
                                    )}
                                  </span>
                                  
                                  {/* Action buttons inline with title */}
                                  {meeting.isDivider && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const newMeetings = meetings.filter(m => m.id !== meeting.id);
                                        if (onReorderMeetings) {
                                          onReorderMeetings(newMeetings);
                                        }
                                      }}
                                      className="text-gray-400 hover:text-red-500 w-4 h-4 flex items-center justify-center flex-shrink-0"
                                      title="Remove divider"
                                    >
                                      ×
                                    </button>
                                  )}
                                  {!meeting.isDivider && meeting.isVirtual && removeVirtualDuplicate && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removeVirtualDuplicate(meeting.virtualId!);
                                      }}
                                      className="text-gray-400 hover:text-red-500 w-4 h-4 flex items-center justify-center flex-shrink-0"
                                      title="Remove virtual duplicate"
                                    >
                                      ×
                                    </button>
                                  )}
                                  {!meeting.isDivider && !meeting.isVirtual && createVirtualDuplicate && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        createVirtualDuplicate(meeting);
                                      }}
                                      className="text-gray-400 hover:text-blue-500 w-4 h-4 flex items-center justify-center flex-shrink-0"
                                      title="Create virtual duplicate"
                                    >
                                      <Copy className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {((groupedMeetings[group] || []).length === 0) && (
                          <div className="h-8 flex items-center justify-center text-gray-300 italic border border-dashed border-gray-200 rounded bg-gray-50">
                            Drop here
                          </div>
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              )}
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}