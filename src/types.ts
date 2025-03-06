export interface Meeting {
  id: string;
  title: string;
  date: string;
  content: string;
  series?: string;
}

export interface ActionItem {
  id: string;
  text: string;
  completed: boolean;
  meetingId: string;
  series?: string;
  createdAt: string;
}