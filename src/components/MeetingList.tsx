import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  updateVirtualDuplicateGroup?: (duplicateId: string, newGroup: string, newSortOrder?: number) => void;
  handleItemReorder?: (draggedId: string, newGroup: string, newSortOrder: number) => void;
  handleBatchItemReorder?: (updates: Array<{id: string, group: string, sortOrder: number}>) => void;
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
  updateVirtualDuplicateGroup,
  handleItemReorder,
  handleBatchItemReorder,
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

  const [hoveredMeetingId, setHoveredMeetingId] = useState<string | null>(null);
  const [hoveredGroupName, setHoveredGroupName] = useState<string | null>(null);

  // Debounce mouse events to prevent performance violations
  const mouseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const debouncedSetHoveredMeetingId = useCallback((id: string | null) => {
    if (mouseTimeoutRef.current) {
      clearTimeout(mouseTimeoutRef.current);
    }
    mouseTimeoutRef.current = setTimeout(() => {
      setHoveredMeetingId(id);
    }, 16); // ~60fps
  }, []);

  const debouncedSetHoveredGroupName = useCallback((name: string | null) => {
    if (mouseTimeoutRef.current) {
      clearTimeout(mouseTimeoutRef.current);
    }
    mouseTimeoutRef.current = setTimeout(() => {
      setHoveredGroupName(name);
    }, 16); // ~60fps
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (mouseTimeoutRef.current) {
        clearTimeout(mouseTimeoutRef.current);
      }
    };
  }, []);

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

  // Memoize expensive operations
  const { activeMeetings, archivedMeetings, groupedMeetings, groupedArchivedMeetings } = useMemo(() => {
    // Separate archived and non-archived meetings
    const activeMeetings = meetings.filter(meeting => !meeting.isArchived);
    const archivedMeetings = meetings.filter(meeting => meeting.isArchived);

    // Group meetings by their group and sort within each group
    const groupedMeetings = activeMeetings.reduce((acc, meeting) => {
      const group = meeting.group || '';
      if (!acc[group]) {
        acc[group] = [];
      }
      acc[group].push(meeting);
      return acc;
    }, {} as Record<string, (Meeting & { isVirtual?: boolean; virtualId?: string; originalMeetingId?: string })[]>);

    // Group archived meetings
    const groupedArchivedMeetings = archivedMeetings.reduce((acc, meeting) => {
      const group = meeting.group || '';
      if (!acc[group]) {
        acc[group] = [];
      }
      acc[group].push(meeting);
      return acc;
    }, {} as Record<string, (Meeting & { isVirtual?: boolean; virtualId?: string; originalMeetingId?: string })[]>);

    // Sort meetings within each group by sortOrder
    Object.keys(groupedMeetings).forEach(group => {
      groupedMeetings[group].sort((a, b) => (a.sortOrder || a.createdAt) - (b.sortOrder || b.createdAt));
    });

    // Sort archived meetings within each group by sortOrder
    Object.keys(groupedArchivedMeetings).forEach(group => {
      groupedArchivedMeetings[group].sort((a, b) => (a.sortOrder || a.createdAt) - (b.sortOrder || b.createdAt));
    });

    return { activeMeetings, archivedMeetings, groupedMeetings, groupedArchivedMeetings };
  }, [meetings]);

  // Memoize sorted groups
  const sortedGroups = useMemo(() => {
    return [''].concat(groups);
  }, [groups]);

  // Move group up or down
  const moveGroup = useCallback((group: string, direction: 'up' | 'down') => {
    const idx = groups.indexOf(group);
    if (idx === -1) return;
    let newGroups = [...groups];
    if (direction === 'up' && idx > 0) {
      [newGroups[idx], newGroups[idx - 1]] = [newGroups[idx - 1], newGroups[idx]];
    } else if (direction === 'down' && idx < newGroups.length - 1) {
      [newGroups[idx], newGroups[idx + 1]] = [newGroups[idx + 1], newGroups[idx]];
    }
    setGroups(newGroups);
  }, [groups]);

  const toggleGroup = useCallback((group: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  }, []);

  const handleNewGroup = useCallback(() => {
    if (newGroupName.trim() && !groups.includes(newGroupName.trim())) {
      setGroups(prev => [...prev, newGroupName.trim()]);
      setExpandedGroups(prev => new Set([...prev, newGroupName.trim()]));
    }
    setNewGroupName('');
    setShowNewGroupInput(false);
  }, [newGroupName, groups]);

  // Handle adding a new divider
  const handleNewDivider = useCallback(() => {
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
  }, [meetings, onReorderMeetings]);

  // Handle drag end for meetings
  const onDragEnd = useCallback((result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination || !handleBatchItemReorder) return;

    const [sourceGroup, destGroup] = [source.droppableId, destination.droppableId];
    if (sourceGroup === destGroup && source.index === destination.index) return;

    // Get the current items in the destination group
    const currentGroupItems = [...(groupedMeetings[destGroup] || [])];

    // Find the dragged item
    const allItems = Object.values(groupedMeetings).flat();
    const draggedItem = allItems.find(item => item.id === draggableId);
    if (!draggedItem) return;

    // Build the new order for the destination group
    let newOrder: typeof currentGroupItems;

    if (sourceGroup === destGroup) {
      // Moving within same group - remove from old position, insert at new
      const filtered = currentGroupItems.filter(item => item.id !== draggableId);
      newOrder = [
        ...filtered.slice(0, destination.index),
        draggedItem,
        ...filtered.slice(destination.index)
      ];
    } else {
      // Moving to different group - just insert at destination
      newOrder = [
        ...currentGroupItems.slice(0, destination.index),
        draggedItem,
        ...currentGroupItems.slice(destination.index)
      ];
    }

    // Assign clean sequential sort orders (1000, 2000, 3000, etc.)
    // This avoids all the edge cases with mixed sortOrder/createdAt values
    const baseSort = 1000;
    const sortIncrement = 1000;
    const newGroup = destGroup === 'ungrouped' ? '' : destGroup;

    // Build batch updates for all items in the group
    const updates = newOrder.map((item, index) => ({
      id: item.id,
      group: newGroup,
      sortOrder: baseSort + (index * sortIncrement)
    }));

    // Update all items atomically
    handleBatchItemReorder(updates);
  }, [groupedMeetings, handleBatchItemReorder]);

  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingMeetingId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingMeetingId]);

  // Memoize the meeting selection handler to prevent unnecessary re-renders
  const handleMeetingSelect = useCallback((meeting: Meeting & { isVirtual?: boolean; virtualId?: string; originalMeetingId?: string }) => {
    if (!meeting.isDivider) {
      onSelectMeeting(meeting);
    }
  }, [onSelectMeeting]);

  // Memoize the meeting update handler
  const handleMeetingUpdate = useCallback((meeting: Meeting & { isVirtual?: boolean; virtualId?: string; originalMeetingId?: string }, newTitle: string) => {
    if (newTitle.trim() && newTitle !== meeting.title) {
      onUpdateMeeting({ ...meeting, title: newTitle.trim() });
    }
    setEditingMeetingId(null);
    const editorElement = document.querySelector('.ProseMirror');
    if (editorElement) {
      (editorElement as HTMLElement).focus();
    }
  }, [onUpdateMeeting]);

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
                  onMouseEnter={() => debouncedSetHoveredGroupName(group)}
                  onMouseLeave={() => debouncedSetHoveredGroupName(null)}
                >
                  {expandedGroups.has(group) ? (
                    <ChevronDown className="w-4 h-4 text-blue-700" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-blue-700" />
                  )}
                  <span className="ml-2 text-base font-bold text-blue-800 tracking-wide uppercase flex-1">{group}</span>
                  {/* Group move up/down buttons */}
                  {hoveredGroupName === group && (
                    <>
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
                    </>
                  )}
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
                                onMouseEnter={() => debouncedSetHoveredMeetingId(meeting.id)}
                                onMouseLeave={() => debouncedSetHoveredMeetingId(null)}
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
                                  onClick={() => handleMeetingSelect(meeting)}
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
                                            handleMeetingUpdate(meeting, editingTitle);
                                          } else if (e.key === 'Escape') {
                                            setEditingMeetingId(null);
                                          }
                                        }}
                                        onBlur={() => handleMeetingUpdate(meeting, editingTitle)}
                                        className="px-1 py-0.5 border border-blue-300 rounded text-sm min-w-0"
                                        onClick={e => e.stopPropagation()}
                                      />
                                    ) : (
                                      meeting.title
                                    )}
                                  </span>
                                  
                                  {/* Action buttons inline with title */}
                                  {meeting.isDivider && hoveredMeetingId === meeting.id && (
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
                                  {!meeting.isDivider && meeting.isVirtual && removeVirtualDuplicate && hoveredMeetingId === meeting.id && (
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
                                  {!meeting.isDivider && !meeting.isVirtual && createVirtualDuplicate && hoveredMeetingId === meeting.id && (
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

          {/* Archived meetings section */}
          {archivedMeetings.length > 0 && (
            <div className="mt-4 border-t border-gray-300">
              <div
                className="flex items-center px-3 py-2 bg-gray-100 border-l-4 border-gray-400 cursor-pointer hover:bg-gray-200 shadow-sm mb-1"
                onClick={() => toggleGroup('archived')}
              >
                {expandedGroups.has('archived') ? (
                  <ChevronDown className="w-4 h-4 text-gray-600" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                )}
                <span className="ml-2 text-base font-bold text-gray-700 tracking-wide uppercase flex-1">
                  Archived ({archivedMeetings.length})
                </span>
              </div>
              {expandedGroups.has('archived') && (
                <div className="space-y-1">
                  {Object.keys(groupedArchivedMeetings).map((group) => (
                    <div key={`archived-${group || 'ungrouped'}`}>
                      {group && (
                        <div className="px-6 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          {group}
                        </div>
                      )}
                      <div className="space-y-1">
                        {(groupedArchivedMeetings[group] || []).map((meeting) => (
                          <div
                            key={meeting.id}
                            className={`px-2 py-1 cursor-pointer flex items-center gap-1 ml-4 opacity-60 ${
                              meeting.isDivider 
                                ? 'text-[11px] font-semibold text-gray-600 bg-gray-50 rounded-md'
                                : selectedMeeting?.id === meeting.id
                                  ? 'bg-gray-100'
                                  : 'hover:bg-gray-100 border-b border-gray-100'
                            }`}
                            onClick={() => handleMeetingSelect(meeting)}
                          >
                            <span className="text-gray-400 flex-shrink-0">
                              <GripVertical size={meeting.isDivider ? 12 : 16} />
                            </span>
                            <div className="text-sm text-gray-600 flex-1 cursor-pointer">
                              <span className="truncate">{meeting.title}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DragDropContext>
    </div>
  );
}