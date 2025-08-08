export interface Meeting {
  id: string;
  title: string;
  date: string;
  notes: string;
  attendees: string[];
  content: string;
  group?: string; // Optional group name for organizing meetings
  isDivider?: boolean; // Whether this meeting is a divider
  subDivider?: string; // Optional sub-divider name for organizing meetings within groups
  sortOrder?: number; // Explicit sort order for positioning
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