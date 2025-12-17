import { AIConfig, AISearchResult, Meeting } from '../types';
import { get, set } from 'idb-keyval';

const AI_CONFIG_KEY = 'aiConfig';

// Default AI config
const defaultAIConfig: AIConfig = {
  apiKey: '',
  apiEndpoint: 'https://api.example.com/ai',
  systemPrompt: 'You are a helpful assistant that analyzes meeting notes and provides insights. Format your responses clearly and concisely.',
};

// Get AI config from storage
export const getAIConfig = async (): Promise<AIConfig> => {
  try {
    const config = await get(AI_CONFIG_KEY);
    return config || defaultAIConfig;
  } catch (error) {
    console.error('Error getting AI config:', error);
    return defaultAIConfig;
  }
};

// Save AI config to storage
export const saveAIConfig = async (config: AIConfig): Promise<void> => {
  try {
    await set(AI_CONFIG_KEY, config);
  } catch (error) {
    console.error('Error saving AI config:', error);
    throw error;
  }
};

// Strip HTML tags from content for AI processing
const stripHtmlTags = (html: string): string => {
  return html
    .replace(/<img[^>]*>/gi, '[image]')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
};

// Format meetings for AI context
export const formatMeetingsForAI = (meetings: Meeting[]): string => {
  return meetings
    .map((meeting) => {
      const content = stripHtmlTags(meeting.content);
      const notes = stripHtmlTags(meeting.notes || '');
      const nextTimeNotes = stripHtmlTags(meeting.nextTimeNotes || '');
      
      let meetingText = `--- Meeting: ${meeting.title} ---\n`;
      meetingText += `Date: ${meeting.date}\n`;
      if (meeting.attendees?.length > 0) {
        meetingText += `Attendees: ${meeting.attendees.join(', ')}\n`;
      }
      if (content) {
        meetingText += `Content:\n${content}\n`;
      }
      if (notes) {
        meetingText += `Notes:\n${notes}\n`;
      }
      if (nextTimeNotes) {
        meetingText += `Next Time Notes:\n${nextTimeNotes}\n`;
      }
      return meetingText;
    })
    .join('\n\n');
};

// Call AI API
export const callAI = async (
  userPrompt: string,
  meetingsContext: string,
  config: AIConfig
): Promise<AISearchResult> => {
  if (!config.apiKey) {
    throw new Error('API key is not configured. Press Ctrl+, to configure AI settings.');
  }

  if (!config.apiEndpoint) {
    throw new Error('API endpoint is not configured. Press Ctrl+, to configure AI settings.');
  }

  const fullPrompt = config.systemPrompt
    ? `${config.systemPrompt}\n\n---\nMeeting Context:\n${meetingsContext}\n---\n\nUser Query: ${userPrompt}`
    : `Meeting Context:\n${meetingsContext}\n\nUser Query: ${userPrompt}`;

  try {
    const response = await fetch(config.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        prompt: fullPrompt,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText}. ${errorText}`);
    }

    const data = await response.json();
    
    // The API returns a response field - adjust based on actual API structure
    const aiResponse = data.response || data.result || data.text || data.content || JSON.stringify(data);
    
    return {
      response: aiResponse,
      timestamp: Date.now(),
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to call AI API');
  }
};
