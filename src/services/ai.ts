import { AIConfig, AISearchResult, Meeting } from '../types';
import { get, set } from 'idb-keyval';

const AI_CONFIG_KEY = 'aiConfig';

// Fixed proxy endpoint - all requests go through Vite proxy
const PROXY_ENDPOINT = '/api/ai';

// Default system prompt
const DEFAULT_SYSTEM_PROMPT = 'You are a helpful assistant that analyzes meeting notes and provides insights. Format your responses clearly and concisely.';

// Get AI config - system prompt from storage, everything else from env
export const getAIConfig = async (): Promise<AIConfig> => {
  try {
    const storedConfig = await get(AI_CONFIG_KEY);
    return {
      systemPrompt: storedConfig?.systemPrompt || DEFAULT_SYSTEM_PROMPT,
    };
  } catch (error) {
    console.error('Error getting AI config:', error);
    return {
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
    };
  }
};

// Save AI config (only system prompt is saved)
export const saveAIConfig = async (config: AIConfig): Promise<void> => {
  try {
    await set(AI_CONFIG_KEY, { systemPrompt: config.systemPrompt });
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

// Call AI API through the Vite proxy
export const callAI = async (
  userPrompt: string,
  meetingsContext: string,
  config: AIConfig
): Promise<AISearchResult> => {
  const fullPrompt = config.systemPrompt
    ? `${config.systemPrompt}\n\n---\nMeeting Context:\n${meetingsContext}\n---\n\nUser Query: ${userPrompt}`
    : `Meeting Context:\n${meetingsContext}\n\nUser Query: ${userPrompt}`;

  try {
    // Debug logging in development
    if (import.meta.env.DEV) {
      console.log('AI API Request:', {
        endpoint: PROXY_ENDPOINT,
        promptLength: fullPrompt.length,
      });
    }

    const response = await fetch(PROXY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: fullPrompt,
      }),
    });

    if (!response.ok) {
      let errorMessage = `API request failed: ${response.status} ${response.statusText}`;
      
      const errorText = await response.text();
      
      if (errorText) {
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.message) {
            errorMessage = errorData.message;
          } else if (typeof errorData === 'string') {
            errorMessage = errorData;
          } else {
            errorMessage = JSON.stringify(errorData);
          }
        } catch {
          errorMessage = errorText;
        }
      }
      
      // Provide helpful context for common errors
      if (response.status === 401 || response.status === 403) {
        errorMessage = `Authentication failed: ${errorMessage}. Check that AI_API_KEY is correctly set in your .env file.`;
      } else if (response.status === 404) {
        errorMessage = `API endpoint not found. Check that VITE_AI_API_TARGET is correctly set in your .env file.`;
      } else if (response.status === 502 || response.status === 503 || response.status === 504) {
        errorMessage = `API server is unavailable (${response.status}). The target API may be down or unreachable.`;
      }
      
      throw new Error(errorMessage);
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
