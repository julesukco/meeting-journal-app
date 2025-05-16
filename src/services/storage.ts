import { get, set, del } from 'idb-keyval';

// Remove the AsyncStorage import and use localStorage instead
const STORAGE_KEYS = {
  MEETINGS: 'meetings',
  REMINDERS: 'reminders',
  GROUPS: 'meetingGroups',
};

export interface Meeting {
  id: string;
  title: string;
  date: string;
  notes: string;
  attendees: string[];
  content: string; // Add this to match your types Meeting interface
}

export interface Reminder {
  id: string;
  text: string;
}

export interface ExportData {
  meetings: Meeting[];
  reminders: Reminder[];
  groups?: string[];
}

// Save meetings
export const saveMeetings = async (meetings: Meeting[]): Promise<void> => {
  try {
    await set(STORAGE_KEYS.MEETINGS, meetings);
  } catch (error) {
    console.error('Error saving meetings:', error);
    throw error;
  }
};

// Get meetings
export const getMeetings = async (): Promise<Meeting[]> => {
  const meetings = await get(STORAGE_KEYS.MEETINGS);
  return meetings ? meetings : [];
};

// Get reminders
export const getReminders = async (): Promise<Reminder[]> => {
  const reminders = await get(STORAGE_KEYS.REMINDERS);
  return reminders ? reminders : [];
};

// Save reminders
export const saveReminders = async (reminders: Reminder[]): Promise<void> => {
  try {
    await set(STORAGE_KEYS.REMINDERS, reminders);
  } catch (error) {
    console.error('Error saving reminders:', error);
    throw error;
  }
};

// Save groups
export const saveGroups = async (groups: string[]): Promise<void> => {
  try {
    await set(STORAGE_KEYS.GROUPS, groups);
  } catch (error) {
    console.error('Error saving groups:', error);
    throw error;
  }
};

// Get groups
export const getGroups = async (): Promise<string[]> => {
  const groups = await get(STORAGE_KEYS.GROUPS);
  return groups ? groups : [];
};

// Add a single meeting
export const addMeeting = async (meeting: Meeting): Promise<void> => {
  try {
    const meetings = await getMeetings();
    meetings.push(meeting);
    await saveMeetings(meetings);
  } catch (error) {
    console.error('Error adding meeting:', error);
    throw error;
  }
};

// Update a meeting
export const updateMeeting = async (updatedMeeting: Meeting): Promise<void> => {
  try {
    const meetings = await getMeetings();
    const index = meetings.findIndex(m => m.id === updatedMeeting.id);
    if (index !== -1) {
      meetings[index] = updatedMeeting;
      await saveMeetings(meetings);
    }
  } catch (error) {
    console.error('Error updating meeting:', error);
    throw error;
  }
};

// Delete a meeting
export const deleteMeeting = async (meetingId: string): Promise<void> => {
  try {
    const meetings = await getMeetings();
    const filteredMeetings = meetings.filter(m => m.id !== meetingId);
    await saveMeetings(filteredMeetings);
  } catch (error) {
    console.error('Error deleting meeting:', error);
    throw error;
  }
};

// Export meetings to JSON file
export const exportMeetings = async (): Promise<string> => {
  const meetings = await getMeetings();
  const reminders = await getReminders();
  const groups = await getGroups();
  const exportData: ExportData = {
    meetings,
    reminders,
    groups,
  };
  return JSON.stringify(exportData, null, 2);
};

// Import meetings from JSON string
export const importMeetings = async (content: string): Promise<void> => {
  try {
    const data: ExportData = JSON.parse(content);
    // Validate the data structure
    if (!Array.isArray(data.meetings)) {
      throw new Error('Invalid meetings data');
    }
    if (!Array.isArray(data.reminders)) {
      throw new Error('Invalid reminders data');
    }
    // Save meetings
    await set(STORAGE_KEYS.MEETINGS, data.meetings);
    // Save reminders
    await set(STORAGE_KEYS.REMINDERS, data.reminders);
    // Save groups (if present)
    if (Array.isArray(data.groups)) {
      await set(STORAGE_KEYS.GROUPS, data.groups);
    }
  } catch (error) {
    console.error('Error importing data:', error);
    throw error;
  }
}; 