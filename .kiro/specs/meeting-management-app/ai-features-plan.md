# AI Features Plan for Meeting Management App

## Overview

This document outlines AI-powered features to enhance the meeting management application. All features leverage the existing API that accepts a `prompt` and `content` string and returns AI-generated results.

---

## Feature 1: Meeting Summary Generation

### Description
Generate concise summaries of meeting content, distilling key points, decisions, and outcomes.

### User Story
*As a meeting participant, I want to generate an AI summary of my meeting notes, so that I can quickly share highlights with stakeholders or refresh my memory later.*

### Implementation Ideas
- **Trigger**: Add a "✨ Summarize" button in the Editor toolbar or meeting header
- **Input**: Pass meeting `content` (HTML stripped to text) as the content parameter
- **Prompt**: "Summarize the following meeting notes in 3-5 bullet points, highlighting key decisions, action items, and important discussion points:"
- **Output Display**: Show in a modal dialog with options to:
  - Copy to clipboard
  - Append to meeting notes
  - Insert at cursor position
  - Share via email (formatted)

### UI Location
- Primary: Button in Editor toolbar (next to existing formatting buttons)
- Secondary: Right-click context menu on meeting in sidebar

---

## Feature 2: Smart Action Item Extraction

### Description
Use AI to identify and extract action items from meeting content, even when they don't follow the "AI:" prefix convention.

### User Story
*As a meeting organizer, I want AI to automatically find all action items in my notes, so that nothing falls through the cracks.*

### Implementation Ideas
- **Trigger**: "🔍 Find Action Items" button or automatic suggestion after meeting edit
- **Input**: Meeting `content` as the content parameter
- **Prompt**: "Identify all action items, tasks, and to-dos from the following meeting notes. For each, extract: the task description, who is responsible (if mentioned), and any deadline (if mentioned). Format as JSON array:"
- **Output**: 
  - Display found items in a preview dialog
  - Allow user to select which to add to the ActionItems list
  - Optionally auto-prefix selected items with "AI:" in the content

### Enhancements
- Show confidence score for each detected item
- Highlight the source text where the action item was found
- Allow bulk-add to action items

---

## Feature 3: Meeting Preparation Assistant

### Description
Generate preparation notes and suggested agenda items based on previous meetings in a series/group.

### User Story
*As a recurring meeting organizer, I want AI to help me prepare for meetings by analyzing past discussions and suggesting topics to follow up on.*

### Implementation Ideas
- **Trigger**: "📋 Prepare Meeting" button when creating/viewing a meeting in a group
- **Input**: Concatenate content from recent meetings in the same group (last 3-5)
- **Prompt**: "Based on these previous meeting notes, generate: 1) A suggested agenda for the next meeting, 2) Open items that need follow-up, 3) Questions to discuss, 4) Key context to remember:"
- **Output**:
  - Insert into `nextTimeNotes` field
  - Or create a new meeting with suggested agenda

### Data Flow
```
Get meetings in same group → Combine recent content → Send to AI → Display suggestions
```

---

## Feature 4: Weekly/Monthly Digest Generation

### Description
Enhance the existing SummaryDialog to generate AI-powered digests across multiple meetings.

### User Story
*As a team lead, I want an AI-generated summary of all meeting activity over the past week, so that I can stay informed without reading every note.*

### Implementation Ideas
- **Trigger**: "✨ Generate AI Digest" button in the existing SummaryDialog
- **Input**: All meeting content from the selected time period
- **Prompt**: "Create an executive summary of these meeting notes from the past week. Include: 1) Major decisions made, 2) Key updates by project/topic, 3) Outstanding action items, 4) Upcoming deadlines or milestones:"
- **Output**:
  - Display in a formatted view within the dialog
  - Export as PDF or email-ready format
  - Option to create a new "Weekly Summary" meeting entry

---

## Feature 5: Intelligent Search Enhancement

### Description
Enhance the SearchDialog with semantic/AI-powered search capabilities.

### User Story
*As a user with many meetings, I want to search using natural language questions, so that I can find information even when I don't remember exact keywords.*

### Implementation Ideas
- **Trigger**: Toggle in SearchDialog for "AI Search" mode
- **Input**: User's search query + meeting contents (or metadata)
- **Prompt**: "Given the user's question: '{query}', analyze these meeting notes and identify the most relevant sections. Return the meeting IDs and relevant excerpts that answer the question:"
- **Two-phase approach**:
  1. Quick keyword search to narrow candidates
  2. AI analysis of top candidates for semantic relevance
- **Output**: Ranked results with relevant excerpts highlighted

---

## Feature 6: Content Improvement Suggestions

### Description
AI-powered suggestions to improve meeting notes quality, clarity, and completeness.

### User Story
*As a note-taker, I want AI to suggest improvements to my meeting notes, so that they are clearer and more useful.*

### Implementation Ideas
- **Trigger**: "✏️ Improve Notes" button or automatic on meeting close
- **Input**: Meeting `content`
- **Prompt Options** (user selectable):
  - "Make these notes more concise while keeping key information"
  - "Organize these notes into clear sections with headers"
  - "Identify gaps or unclear points that need clarification"
  - "Convert informal notes to professional meeting minutes format"
- **Output**:
  - Show diff/comparison view
  - Allow selective acceptance of suggestions
  - One-click replace

---

## Feature 7: Attendee & Topic Extraction

### Description
Automatically extract attendee names and meeting topics from content.

### User Story
*As a meeting organizer, I want AI to automatically populate attendee lists and categorize my meetings, so that I spend less time on metadata.*

### Implementation Ideas
- **Trigger**: Automatic on meeting save (with user setting) or manual button
- **Input**: Meeting `content` and `title`
- **Prompt**: "From this meeting content, extract: 1) Names of attendees/participants mentioned, 2) Main topics/themes discussed, 3) Suggested tags or categories for this meeting:"
- **Output**:
  - Auto-populate `attendees` array
  - Suggest group assignment
  - Add metadata tags (new field)

---

## Feature 8: Follow-up Email Generator

### Description
Generate professional follow-up emails from meeting content.

### User Story
*As a meeting organizer, I want to quickly generate follow-up emails for attendees, so that I can share outcomes efficiently.*

### Implementation Ideas
- **Trigger**: "📧 Generate Follow-up" button in meeting view
- **Input**: Meeting `content`, `title`, `attendees`, `date`
- **Prompt**: "Generate a professional follow-up email for this meeting. Include: greeting, brief summary of discussion, action items with owners, next steps, and closing. Tone should be [professional/friendly/formal]:"
- **Output**:
  - Editable email preview
  - Copy to clipboard
  - Open in default email client (mailto: link)

---

## Feature 9: Related Meetings Finder

### Description
Use AI to find semantically related meetings across the entire collection.

### User Story
*As a user, I want to discover related meetings based on content similarity, so that I can connect related discussions across time.*

### Implementation Ideas
- **Trigger**: "🔗 Find Related" button on meeting view
- **Input**: Current meeting content + summaries/titles of all other meetings
- **Prompt**: "Given this meeting content, identify which of these other meetings are most related based on topics, people, or projects discussed. Explain the connection:"
- **Output**:
  - List of related meetings with relationship explanation
  - Option to create virtual duplicates in related groups
  - Link/reference system between meetings

---

## Feature 10: Real-time Writing Assistant

### Description
In-editor AI assistance for expanding, rephrasing, or completing notes as you type.

### User Story
*As a note-taker, I want AI to help me expand brief notes into complete sentences, so that I can capture more detail without slowing down.*

### Implementation Ideas
- **Trigger**: 
  - Keyboard shortcut (e.g., `Cmd+Shift+A`) with selected text
  - Inline `/ai` command followed by instruction
  - Context menu on text selection
- **Commands**:
  - `/expand` - Expand brief notes into full sentences
  - `/rephrase` - Reword selected text
  - `/continue` - Continue writing from cursor
  - `/bullets` - Convert paragraph to bullet points
  - `/formal` - Make text more formal
- **Output**: Inline replacement or insertion with undo capability

---

## Implementation Architecture

### API Service Layer

```typescript
// src/services/ai.ts

interface AIRequest {
  prompt: string;
  content: string;
}

interface AIResponse {
  result: string;
  // Additional metadata if the API provides it
}

export async function callAI(request: AIRequest): Promise<AIResponse> {
  // Call your AI API here
  // Return the result
}

// Feature-specific wrappers
export async function summarizeMeeting(content: string): Promise<string> {
  return callAI({
    prompt: "Summarize the following meeting notes...",
    content: stripHtml(content)
  });
}

export async function extractActionItems(content: string): Promise<ActionItem[]> {
  const result = await callAI({
    prompt: "Identify all action items...",
    content: stripHtml(content)
  });
  return parseActionItems(result);
}

// ... more feature-specific functions
```

### UI Components Structure

```
src/
  components/
    ai/
      AIButton.tsx           # Reusable AI action button with loading state
      AIResultDialog.tsx     # Modal for displaying AI results
      AISearchToggle.tsx     # Toggle for AI-enhanced search
      AIWritingAssistant.tsx # Inline writing helper
  hooks/
    useAI.ts                 # Custom hook for AI operations with loading/error states
```

### State Management Considerations

- Add loading states for AI operations
- Cache AI results to avoid redundant API calls
- Store user preferences for AI features (on/off toggles)
- Consider rate limiting on the client side

---

## Priority Ranking

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| 🔴 High | 1. Meeting Summary Generation | Low | High |
| 🔴 High | 2. Smart Action Item Extraction | Medium | High |
| 🟡 Medium | 6. Content Improvement Suggestions | Medium | Medium |
| 🟡 Medium | 8. Follow-up Email Generator | Low | Medium |
| 🟡 Medium | 3. Meeting Preparation Assistant | Medium | High |
| 🟡 Medium | 4. Weekly/Monthly Digest | Medium | Medium |
| 🟢 Low | 10. Real-time Writing Assistant | High | Medium |
| 🟢 Low | 5. Intelligent Search Enhancement | High | Medium |
| 🟢 Low | 7. Attendee & Topic Extraction | Low | Low |
| 🟢 Low | 9. Related Meetings Finder | Medium | Low |

---

## Recommended Starting Point

**Start with Feature 1 (Meeting Summary Generation)** because:
1. Simplest implementation - single input/output
2. High user value immediately visible
3. Tests the AI integration end-to-end
4. UI pattern (dialog with results) can be reused for other features
5. Natural extension of existing SummaryDialog component

### Quick Win Implementation Steps for Feature 1:
1. Create `src/services/ai.ts` with the API wrapper
2. Create `src/hooks/useAI.ts` for state management
3. Add "Summarize" button to Editor toolbar
4. Create/extend dialog to show AI-generated summary
5. Add copy/insert actions for the result

---

## User Settings (Future)

Consider adding user preferences for AI features:
- Enable/disable AI features globally
- Default tone for generated content (formal/casual)
- Auto-suggestions on/off
- AI model preferences (if multiple available)
- Content privacy settings (what gets sent to AI)

---

## Error Handling & Edge Cases

- Handle API timeouts gracefully with retry option
- Show meaningful error messages for failed AI calls
- Provide fallback behavior when AI is unavailable
- Handle very long content (chunk and summarize)
- Empty meeting content edge case
- Rate limiting feedback to user
