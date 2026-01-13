export interface Meeting {
  id: string;
  title: string;
  date: string;
  notes: string;
  attendees: string[];
  content: string;
  nextTimeNotes?: string; // Notes for the next meeting
  group?: string; // Optional group name for organizing meetings
  isDivider?: boolean; // Whether this meeting is a divider
  subDivider?: string; // Optional sub-divider name for organizing meetings within groups
  sortOrder?: number; // Explicit sort order for positioning
  isArchived?: boolean; // Whether this meeting is archived
  createdAt: number;
  updatedAt: number;
}

export interface VirtualDuplicate {
  id: string;
  originalMeetingId: string;
  displayTitle: string;
  group?: string;
  sortOrder: number; // Explicit sort order for positioning
  createdAt: number;
}

export interface ActionItem {
  id: string;
  text: string;
  completed: boolean;
  meetingId: string;
  series?: string;
  createdAt: string;
  completedAt?: string;
}

export interface AIConfig {
  systemPrompt: string;
}

export interface AISearchResult {
  response: string;
  timestamp: number;
}

export interface MemoryBankConfig {
  meetingId: string | null;      // ID of the Memory Bank meeting
  lastUpdateTimestamp: number;   // Last successful update time
  updateHistory: UpdateEntry[];  // History of updates
}

export interface UpdateEntry {
  timestamp: number;
  sessionsProcessed: number;
  summary: string;  // Brief description of what was added
}