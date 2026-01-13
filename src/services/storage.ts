import { get, set, del } from 'idb-keyval';
import { ActionItem, MemoryBankConfig } from '../types';

// Remove the AsyncStorage import and use localStorage instead
const STORAGE_KEYS = {
  MEETINGS: 'meetings',
  REMINDERS: 'reminders',
  GROUPS: 'meetingGroups',
  MEMORY_BANK_CONFIG: 'memoryBankConfig',
};

export interface Meeting {
  id: string;
  title: string;
  date: string;
  notes: string;
  attendees: string[];
  content: string;
  nextTimeNotes?: string; // Notes for the next meeting
  group?: string;
  isDivider?: boolean;
  subDivider?: string;
  isArchived?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Reminder {
  id: string;
  text: string;
}

export interface ExportData {
  meetings: Meeting[];
  reminders: Reminder[];
  groups?: string[];
  actionItems?: ActionItem[];
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

// Get Memory Bank config
export const getMemoryBankConfig = async (): Promise<MemoryBankConfig> => {
  const config = await get(STORAGE_KEYS.MEMORY_BANK_CONFIG);
  return config ? config : {
    meetingId: null,
    lastUpdateTimestamp: 0,
    updateHistory: []
  };
};

// Save Memory Bank config
export const saveMemoryBankConfig = async (config: MemoryBankConfig): Promise<void> => {
  try {
    await set(STORAGE_KEYS.MEMORY_BANK_CONFIG, config);
  } catch (error) {
    console.error('Error saving Memory Bank config:', error);
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
    // Explicitly log what we're getting from IndexedDB for debugging
    console.log('Exporting data from IndexedDB...');
    
    const meetings = await getMeetings();
    console.log('Meetings to export:', {
      count: meetings.length,
      dividers: meetings.filter(m => m.isDivider).length,
      sample: meetings.slice(0, 2)
    });
    
    const reminders = await getReminders();
    console.log('Reminders to export:', {
      count: reminders.length,
      sample: reminders.slice(0, 2)
    });
    
    const groups = await getGroups();
    console.log('Groups to export:', {
      count: groups.length,
      groups: groups
    });
    
    // Also export action items if they exist
    const actionItems = await get('actionItems') || [];
    console.log('Action items to export:', {
      count: actionItems.length,
      sample: actionItems.slice(0, 2)
    });
    
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
    console.log('Export data preview:', jsonString.substring(0, 200) + '...');
    
    return jsonString;
  } catch (error) {
    console.error('Error during export:', error);
    throw error;
  }
};

// Optimize database by compressing existing images
export const optimizeDatabase = async (): Promise<{ originalSize: number; optimizedSize: number }> => {
  try {
    const meetings = await getMeetings();
    let originalSize = 0;
    let optimizedSize = 0;
    
    // Create a temporary canvas for image compression
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    const compressImageInContent = (content: string): string => {
      return content.replace(/<img[^>]+src="([^"]+)"[^>]*>/gi, (match, src) => {
        if (src.startsWith('data:image/')) {
          // This is a base64 image, try to compress it
          const img = document.createElement('img');
          img.onload = () => {
            const maxWidth = 1200;
            let { width, height } = img;
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
            
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            // Replace the image src in the content
            content = content.replace(src, compressedDataUrl);
          };
          img.src = src;
        }
        return match;
      });
    };
    
    // Process each meeting
    for (const meeting of meetings) {
      const originalContent = meeting.content;
      originalSize += originalContent.length;
      
      const optimizedContent = compressImageInContent(originalContent);
      optimizedSize += optimizedContent.length;
      
      // Update the meeting with optimized content
      meeting.content = optimizedContent;
    }
    
    // Save the optimized meetings
    await saveMeetings(meetings);
    
    return { originalSize, optimizedSize };
  } catch (error) {
    console.error('Error optimizing database:', error);
    throw error;
  }
};

// Import meetings from JSON string
export const importMeetings = async (content: string): Promise<void> => {
  try {
    console.log('Starting import process...');
    
    // Create a backup of current data
    const backup = {
      meetings: await getMeetings(),
      reminders: await getReminders(),
      groups: await getGroups(),
      actionItems: await get('actionItems') || []
    };
    console.log('Created backup of current data:', {
      meetingsCount: backup.meetings.length,
      remindersCount: backup.reminders.length,
      groupsCount: backup.groups.length,
      actionItemsCount: backup.actionItems.length
    });
    
    // Parse and validate the imported data
    const data: ExportData & { actionItems?: ActionItem[] } = JSON.parse(content);
    console.log('Parsed import data:', {
      meetingsCount: data.meetings?.length || 0,
      remindersCount: data.reminders?.length || 0,
      groupsCount: data.groups?.length || 0,
      actionItemsCount: data.actionItems?.length || 0
    });
    
    // Validate meetings
    if (!Array.isArray(data.meetings)) {
      throw new Error('Invalid meetings data - meetings array is missing');
    }
    
    // Validate each meeting has required fields and add defaults for missing timestamps
    const now = Date.now();
    const validatedMeetings = data.meetings.map((meeting, index) => {
      const requiredFields = ['id', 'title', 'date', 'content', 'notes', 'attendees'];
      const missingFields = requiredFields.filter(field => !(field in meeting));
      if (missingFields.length > 0) {
        throw new Error(`Invalid meeting at index ${index} - missing required fields: ${missingFields.join(', ')}`);
      }

      // Add default timestamps if missing
      return {
        ...meeting,
        createdAt: meeting.createdAt || now,
        updatedAt: meeting.updatedAt || now
      };
    });
    
    console.log(`Validated ${validatedMeetings.length} meetings to import`);
    console.log('Sample of meetings to import:', validatedMeetings.slice(0, 2));
    
    // Validate reminders
    const reminders = Array.isArray(data.reminders) ? data.reminders : [];
    reminders.forEach((reminder, index) => {
      if (!reminder.id || !reminder.text) {
        throw new Error(`Invalid reminder at index ${index} - missing required fields`);
      }
    });
    console.log(`Found ${reminders.length} reminders to import`);
    
    // Validate action items if present
    if (data.actionItems) {
      if (!Array.isArray(data.actionItems)) {
        throw new Error('Invalid action items data - must be an array');
      }
      data.actionItems.forEach((item, index) => {
        const requiredFields = ['id', 'text', 'completed', 'meetingId', 'createdAt'];
        const missingFields = requiredFields.filter(field => !(field in item));
        if (missingFields.length > 0) {
          throw new Error(`Invalid action item at index ${index} - missing required fields: ${missingFields.join(', ')}`);
        }
      });
      console.log(`Found ${data.actionItems.length} action items to import`);
    }
    
    try {
      // Save meetings with validated data
      await set(STORAGE_KEYS.MEETINGS, validatedMeetings);
      console.log('Meetings saved to IndexedDB');
      
      // Verify meetings were saved
      const savedMeetings = await getMeetings();
      console.log('Verified saved meetings:', {
        count: savedMeetings.length,
        sample: savedMeetings.slice(0, 2)
      });
      
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
      
      // Final verification
      const finalMeetings = await getMeetings();
      console.log('Final verification - meetings in IndexedDB:', {
        count: finalMeetings.length,
        dividers: finalMeetings.filter(m => m.isDivider).length,
        sample: finalMeetings.slice(0, 2)
      });
      
      console.log('Import completed successfully');
    } catch (error) {
      // If anything fails during save, restore from backup
      console.error('Error during import, restoring from backup:', error);
      await set(STORAGE_KEYS.MEETINGS, backup.meetings);
      await set(STORAGE_KEYS.REMINDERS, backup.reminders);
      await set(STORAGE_KEYS.GROUPS, backup.groups);
      await set('actionItems', backup.actionItems);
      throw new Error('Import failed, restored from backup: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  } catch (error) {
    console.error('Error importing data:', error);
    throw error;
  }
};