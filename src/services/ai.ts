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
    .replace(/<img[^>]*>/gi, '') // Remove images completely
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

// Parse a date string in various formats (M/D/YYYY, MM/DD/YYYY, Month D, YYYY, etc.)
const parseSessionDate = (dateStr: string): Date | null => {
  // Try M/D/YYYY or MM/DD/YYYY format
  const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    const month = parseInt(slashMatch[1], 10) - 1;
    const day = parseInt(slashMatch[2], 10);
    let year = parseInt(slashMatch[3], 10);
    if (year < 100) year += 2000; // Handle 2-digit years
    return new Date(year, month, day);
  }

  // Try "Month D, YYYY" format
  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'];
  const longMatch = dateStr.toLowerCase().match(/^([a-z]+)\s+(\d{1,2}),?\s*(\d{4})$/);
  if (longMatch) {
    const monthIndex = monthNames.indexOf(longMatch[1]);
    if (monthIndex !== -1) {
      const day = parseInt(longMatch[2], 10);
      const year = parseInt(longMatch[3], 10);
      return new Date(year, monthIndex, day);
    }
  }

  return null;
};

// Extract sessions from meeting content that are within the given date range
// Returns the filtered content as plain text
export const extractSessionsInDateRange = (htmlContent: string, startDate: Date, endDate: Date): string => {
  // First strip images completely
  const contentWithoutImages = htmlContent.replace(/<img[^>]*>/gi, '');

  // Convert HTML to text while preserving line breaks
  const textContent = contentWithoutImages
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Split into lines
  const lines = textContent.split('\n');

  // Date patterns to look for at the start of a line
  const datePatterns = [
    /^\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*$/,  // M/D/YYYY or MM/DD/YYYY
    /^\s*([A-Za-z]+\s+\d{1,2},?\s*\d{4})\s*$/,  // Month D, YYYY
  ];

  // Find all sessions with their dates
  const sessions: { date: Date | null; startLine: number; dateStr: string }[] = [];

  lines.forEach((line, index) => {
    for (const pattern of datePatterns) {
      const match = line.match(pattern);
      if (match) {
        const dateStr = match[1].trim();
        const parsedDate = parseSessionDate(dateStr);
        if (parsedDate) {
          sessions.push({ date: parsedDate, startLine: index, dateStr });
        }
        break;
      }
    }
  });

  // If no date headers found, return empty (no sessions to extract)
  if (sessions.length === 0) {
    return '';
  }

  // Filter sessions that are within the date range (inclusive)
  const filteredSessions: string[] = [];

  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i];
    if (session.date && session.date >= startDate && session.date <= endDate) {
      // Get content from this session's date line to the next session (or end)
      const endLine = i + 1 < sessions.length ? sessions[i + 1].startLine : lines.length;
      const sessionLines = lines.slice(session.startLine, endLine);
      const sessionContent = sessionLines.join('\n').trim();
      if (sessionContent) {
        filteredSessions.push(sessionContent);
      }
    }
  }

  return filteredSessions.join('\n\n---\n\n');
};

// Backwards compatibility wrapper
export const extractSessionsAfterDate = (htmlContent: string, startDate: Date): string => {
  const farFuture = new Date(2100, 0, 1);
  return extractSessionsInDateRange(htmlContent, startDate, farFuture);
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

// Memory Bank system prompt for extracting critical information
const MEMORY_BANK_EXTRACTION_PROMPT = `You are analyzing meeting notes to extract critical information for a Memory Bank.

Context: Each meeting topic contains multiple dated sessions (entries starting with a date like "1/10/2025").
You are seeing only the new sessions since the last Memory Bank update.

Extract and organize information into these sections:

## Decisions Made
[Finalized choices and their rationale]

## Strategic Goals
[Current objectives and priorities]

## People Insights
Group insights by person name. For each person mentioned, list their preferences, communication style, goals, or other relevant observations.
Format as:
### [Person Name]
- [insight 1]
- [insight 2]

## Key Data Points
[Numbers, metrics, important facts]

## Open Questions
[Unresolved items needing follow-up]

Rules:
- Only include substantive, actionable information
- Be concise but preserve important context
- Skip sections entirely if no relevant information found (don't include empty sections)
- Format as clean markdown
- Do not repeat information that would naturally belong in multiple sections`;

// Memory Bank merge prompt for combining new extraction with existing content
const MEMORY_BANK_MERGE_PROMPT = `You are updating a Memory Bank document with newly extracted information.
Your task is to intelligently merge the new information into the existing Memory Bank content.

Rules:
- Update existing entries if the new information provides an update or correction
- Add new entries that don't already exist
- Remove or mark as resolved any items that are no longer relevant based on new information
- Maintain the same section structure (Decisions Made, Strategic Goals, People Insights, Key Data Points, Open Questions)
- For People Insights, keep entries grouped by person name (### Person Name format)
- When merging people insights, add new insights under the existing person's heading or create a new person heading
- Keep the content concise and avoid duplication
- Preserve important historical context when updating entries
- Output the complete merged Memory Bank content in clean markdown format`;

// Extract Memory Bank content from pre-filtered meeting sessions
// Takes a map of meeting title -> filtered session content
export const extractMemoryBankContent = async (
  filteredContent: { title: string; content: string }[]
): Promise<string> => {
  // Format the filtered content for AI
  const context = filteredContent
    .map(({ title, content }) => `--- Meeting Topic: ${title} ---\n${content}`)
    .join('\n\n');

  const config: AIConfig = {
    systemPrompt: MEMORY_BANK_EXTRACTION_PROMPT
  };

  const result = await callAI(
    'Extract critical information from these meeting notes for the Memory Bank.',
    context,
    config
  );

  return result.response;
};

// Merge new extraction with existing Memory Bank content
export const mergeMemoryBankContent = async (
  existingContent: string,
  newExtraction: string
): Promise<string> => {
  const context = `EXISTING MEMORY BANK CONTENT:
${existingContent}

---

NEWLY EXTRACTED INFORMATION:
${newExtraction}`;

  const config: AIConfig = {
    systemPrompt: MEMORY_BANK_MERGE_PROMPT
  };

  const result = await callAI(
    'Merge the newly extracted information into the existing Memory Bank content.',
    context,
    config
  );

  return result.response;
};
