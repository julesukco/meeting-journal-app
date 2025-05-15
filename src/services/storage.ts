// Remove the AsyncStorage import and use localStorage instead
const STORAGE_KEYS = {
  MEETINGS: 'meetings',
};

export interface Meeting {
  id: string;
  title: string;
  date: string;
  notes: string;
  attendees: string[];
  content: string; // Add this to match your types Meeting interface
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
  try {
    const jsonValue = localStorage.getItem(STORAGE_KEYS.MEETINGS);
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch (error) {
    console.error('Error getting meetings:', error);
    throw error;
  }
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
    const meetings = await getMeetings();
    const jsonString = JSON.stringify(meetings, null, 2);
    return jsonString;
  } catch (error) {
    console.error('Error exporting meetings:', error);
    throw error;
  }
};

// Import meetings from JSON string
export const importMeetings = async (jsonString: string): Promise<void> => {
  try {
    const importedMeetings = JSON.parse(jsonString);
    // Validate the imported data structure
    if (!Array.isArray(importedMeetings)) {
      throw new Error('Invalid data format');
    }
    // Validate each meeting object
    importedMeetings.forEach(meeting => {
      if (!meeting.id || !meeting.title || !meeting.date) {
        throw new Error('Invalid meeting data structure');
      }
    });
    await saveMeetings(importedMeetings);
  } catch (error) {
    console.error('Error importing meetings:', error);
    throw error;
  }
}; 