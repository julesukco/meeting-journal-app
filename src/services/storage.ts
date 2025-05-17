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
  try {
    // Explicitly log what we're getting from IndexedDB for debugging
    console.log('Exporting data from IndexedDB...');
    
    const meetings = await getMeetings();
    console.log('Meetings to export:', meetings);
    
    const reminders = await getReminders();
    console.log('Reminders to export:', reminders);
    
    const groups = await getGroups();
    console.log('Groups to export:', groups);
    
    // Also export action items if they exist
    const actionItems = await get('actionItems') || [];
    console.log('Action items to export:', actionItems);
    
    // Create the export data object
    const exportData: ExportData & { actionItems?: any[] } = {
      meetings,
      reminders,
      groups,
      actionItems, // Include action items in the export
    };
    
    // Convert to JSON string
    const jsonString = JSON.stringify(exportData, null, 2);
    console.log('Export data size:', jsonString.length);
    
    return jsonString;
  } catch (error) {
    console.error('Error during export:', error);
    throw error;
  }
};

// Import meetings from JSON string
export const importMeetings = async (content: string): Promise<void> => {
  try {
    console.log('Starting import process...');
    const data: ExportData & { actionItems?: any[] } = JSON.parse(content);
    
    // Validate the data structure
    if (!Array.isArray(data.meetings)) {
      throw new Error('Invalid meetings data - meetings array is missing');
    }
    console.log(`Found ${data.meetings.length} meetings to import`);
    
    // Reminders might be empty in some exports, so provide a default empty array
    const reminders = Array.isArray(data.reminders) ? data.reminders : [];
    console.log(`Found ${reminders.length} reminders to import`);
    
    // Save meetings
    await set(STORAGE_KEYS.MEETINGS, data.meetings);
    console.log('Meetings saved to IndexedDB');
    
    // Save reminders
    await set(STORAGE_KEYS.REMINDERS, reminders);
    console.log('Reminders saved to IndexedDB');
    
    // Save groups (if present)
    if (Array.isArray(data.groups)) {
      await set(STORAGE_KEYS.GROUPS, data.groups);
      console.log(`${data.groups.length} groups saved to IndexedDB`);
    }
    
    // Save action items if present
    if (Array.isArray(data.actionItems)) {
      await set('actionItems', data.actionItems);
      console.log(`${data.actionItems.length} action items saved to IndexedDB`);
    }
    
    console.log('Import completed successfully');
  } catch (error) {
    console.error('Error importing data:', error);
    throw error;
  }
}; 