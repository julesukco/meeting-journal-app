import { AIConfig, AISearchResult, Meeting } from '../types';
import { get, set } from 'idb-keyval';

const AI_CONFIG_KEY = 'aiConfig';

// Default AI config
// Use /api/ai as the default endpoint - this is proxied through Vite to avoid CORS issues
// Set the actual target URL via VITE_AI_API_TARGET environment variable
const defaultAIConfig: AIConfig = {
  apiKey: '',
  apiEndpoint: '/api/ai',
  systemPrompt: 'You are a helpful assistant that analyzes meeting notes and provides insights. Format your responses clearly and concisely.',
};

// Get AI config from storage, with environment variable override
export const getAIConfig = async (): Promise<AIConfig> => {
  try {
    // Check for environment variables first (highest priority)
    const envApiKey = import.meta.env.VITE_AI_API_KEY;
    const envApiEndpoint = import.meta.env.VITE_AI_API_ENDPOINT;
    
    // Get stored config from IndexedDB
    const storedConfig = await get(AI_CONFIG_KEY);
    
    // Build config with priority: env vars > stored config > defaults
    let config: AIConfig;
    
    if (storedConfig) {
      config = { ...storedConfig };
    } else {
      config = { ...defaultAIConfig };
    }
    
    // Override with environment variables if set
    if (envApiKey) {
      config.apiKey = envApiKey;
    }
    if (envApiEndpoint) {
      config.apiEndpoint = envApiEndpoint;
    }
    
    // Migrate: if endpoint is a full external URL, update to use proxy
    if (config.apiEndpoint && 
        (config.apiEndpoint.startsWith('http://') || config.apiEndpoint.startsWith('https://')) &&
        !config.apiEndpoint.startsWith('http://localhost')) {
      console.log('Migrating AI config to use proxy endpoint');
      const migratedConfig = {
        ...config,
        apiEndpoint: '/api/ai',
      };
      await set(AI_CONFIG_KEY, migratedConfig);
      return migratedConfig;
    }
    
    return config;
  } catch (error) {
    console.error('Error getting AI config:', error);
    // Fallback to defaults, but still check env vars
    return {
      ...defaultAIConfig,
      apiKey: import.meta.env.VITE_AI_API_KEY || defaultAIConfig.apiKey,
      apiEndpoint: import.meta.env.VITE_AI_API_ENDPOINT || defaultAIConfig.apiEndpoint,
    };
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
  if (!config.apiKey || config.apiKey.trim() === '') {
    throw new Error('API key is not configured. Set VITE_AI_API_KEY in your .env file or press Ctrl+, to configure in settings.');
  }

  if (!config.apiEndpoint || config.apiEndpoint.trim() === '') {
    throw new Error('API endpoint is not configured. Press Ctrl+, to configure AI settings.');
  }

  const fullPrompt = config.systemPrompt
    ? `${config.systemPrompt}\n\n---\nMeeting Context:\n${meetingsContext}\n---\n\nUser Query: ${userPrompt}`
    : `Meeting Context:\n${meetingsContext}\n\nUser Query: ${userPrompt}`;

  try {
    // Build headers - some APIs use x-api-key instead of Authorization
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Determine which authentication header to use
    // AWS API Gateway typically uses x-api-key, while most other APIs use Authorization Bearer
    if (config.apiKey) {
      // Check if endpoint looks like AWS API Gateway (contains .execute-api. or api-gateway)
      const isAwsApiGateway = config.apiEndpoint.includes('.execute-api.') || 
                              config.apiEndpoint.includes('api-gateway') ||
                              config.apiEndpoint.includes('amazonaws.com');
      
      // If using proxy endpoint, we can't detect the actual API type
      // Send both headers to cover different API authentication styles
      const isProxyEndpoint = config.apiEndpoint.startsWith('/api/');
      
      if (isAwsApiGateway) {
        // AWS API Gateway uses x-api-key header
        headers['x-api-key'] = config.apiKey;
      } else if (isProxyEndpoint) {
        // For proxy endpoints, send both headers since we don't know which the backend expects
        // This covers both AWS API Gateway (x-api-key) and standard APIs (Authorization Bearer)
        headers['x-api-key'] = config.apiKey;
        headers['Authorization'] = `Bearer ${config.apiKey}`;
      } else {
        // Standard OAuth-style API uses Authorization Bearer
        headers['Authorization'] = `Bearer ${config.apiKey}`;
      }
    }

    // Debug logging (remove in production if needed)
    if (import.meta.env.DEV) {
      console.log('AI API Request:', {
        endpoint: config.apiEndpoint,
        headers: Object.keys(headers).map(k => `${k}: ${k === 'x-api-key' || k === 'Authorization' ? '***' : headers[k]}`),
        hasApiKey: !!config.apiKey,
        apiKeyLength: config.apiKey?.length || 0,
      });
    }

    const response = await fetch(config.apiEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        prompt: fullPrompt,
      }),
    });

    if (!response.ok) {
      let errorMessage = `API request failed: ${response.status} ${response.statusText}`;
      
      // Read response as text first (can only read body once)
      const errorText = await response.text();
      
      if (errorText) {
        try {
          // Try parsing the text as JSON
          const errorData = JSON.parse(errorText);
          if (errorData.message) {
            errorMessage = errorData.message;
          } else if (typeof errorData === 'string') {
            errorMessage = errorData;
          } else {
            errorMessage = JSON.stringify(errorData);
          }
        } catch {
          // If not JSON, use as plain text
          errorMessage = errorText;
        }
      }
      
      // Provide helpful context for authentication errors
      if (response.status === 401 || response.status === 403 || errorMessage.includes('Authentication') || errorMessage.includes('Token') || errorMessage.includes('Missing')) {
        if (!config.apiKey || config.apiKey.trim() === '') {
          errorMessage = 'API key is missing. Please configure your API key in settings (Ctrl+,).';
        } else {
          errorMessage = `Authentication failed: ${errorMessage}. Please check your API key in settings (Ctrl+,). The API might require a different header format.`;
        }
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
