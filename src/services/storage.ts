// Remove the AsyncStorage import and use localStorage instead
const STORAGE_KEYS = {
  MEETINGS: 'meetings',
  REMINDERS: 'reminders'
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
}

// Save meetings
export const saveMeetings = async (meetings: Meeting[]): Promise<void> => {
  try {
    const jsonValue = JSON.stringify(meetings);
    localStorage.setItem(STORAGE_KEYS.MEETINGS, jsonValue);
  } catch (error) {
    console.error('Error saving meetings:', error);
    throw error;
  }
};

// Get meetings
export const getMeetings = async (): Promise<Meeting[]> => {
  const meetings = localStorage.getItem(STORAGE_KEYS.MEETINGS);
  return meetings ? JSON.parse(meetings) : [];
};

// Get reminders
export const getReminders = async (): Promise<Reminder[]> => {
  const reminders = localStorage.getItem(STORAGE_KEYS.REMINDERS);
  return reminders ? JSON.parse(reminders) : [];
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
  const exportData: ExportData = {
    meetings,
    reminders
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
    localStorage.setItem(STORAGE_KEYS.MEETINGS, JSON.stringify(data.meetings));
    
    // Save reminders
    localStorage.setItem(STORAGE_KEYS.REMINDERS, JSON.stringify(data.reminders));
  } catch (error) {
    console.error('Error importing data:', error);
    throw error;
  }
}; 