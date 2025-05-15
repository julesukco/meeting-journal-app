export interface Meeting {
  id: string;
  title: string;
  date: string;
  notes: string;
  attendees: string[];
  content: string;
  group?: string; // Optional group name for organizing meetings
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