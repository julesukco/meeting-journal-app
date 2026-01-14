# Meeting Journal App - AI Assistant Context

## What This App Does

A React-based desktop-class web application for creating, organizing, and managing meeting notes with a rich text editor. Key features include automatic action item extraction (using "AI:" prefix pattern), virtual meeting duplicates for multi-group organization, next-time notes for meeting preparation, and a three-panel workspace with drag-and-drop organization. All data is stored locally in IndexedDB for offline-first operation.

## Usage

Each meeting has an entry that appears in the left navigation. When click the meeting notes are displayed. The meetings are typically recurring meetings. Each session of the meeting is notated with a date delimiter, followed by the highlights from the meeting. The most recent meetings are stored at the end of the note. Images can be embedded in the note. Here's an example meeting note:

12/15/25
- some note here
- important decision

1/4/26
- more details from the next meeting


## Core Architecture

**Stack:**
- React 18 + TypeScript + Vite
- TipTap (rich text editor)
- IndexedDB (via idb-keyval) for persistence
- Tailwind CSS for styling
- react-beautiful-dnd for drag-and-drop
- React Router v7.6

**Key Architectural Patterns:**
- Centralized state management in App component (no Redux/Context API)
- Unidirectional data flow with props and callbacks
- Auto-save with 500ms debouncing
- Offline-first design (no server communication)
- Client-side only (all data local)
- Functionality that uses AI is performed via an AI API call

## Project Structure

```
src/
├── App.tsx                    # Root component, global state, CRUD operations
├── main.tsx                   # Entry point
├── types.ts                   # All TypeScript interfaces
├── components/                # React components
│   ├── MeetingList.tsx       # Left sidebar with drag-and-drop groups
│   ├── Editor.tsx            # TipTap rich text editor
│   ├── RightNav.tsx          # Action items and meeting tools
│   ├── MeetingTabs.tsx       # Tab management for open meetings
│   ├── NextTimeNotes.tsx     # Bottom panel for next meeting prep
│   ├── ActionItems.tsx       # Action item display/management
│   ├── Reminders.tsx         # Reminder management
│   ├── SearchDialog.tsx      # Global search (\ shortcut)
│   ├── AIConfigDialog.tsx    # AI configuration settings
│   ├── MemoryBankDialog.tsx  # Memory bank management
│   ├── SummaryDialog.tsx     # Meeting summaries
│   └── PerformanceMonitor.tsx # Performance tracking
├── screens/
│   └── MeetingListScreen.tsx # Main screen layout
├── services/
│   ├── storage.ts            # IndexedDB operations
│   └── ai.ts                 # AI integration service
├── lib/
│   └── quill-init.ts         # Editor initialization
└── styles/
    ├── index.css             # Global styles
    └── editor.css            # Editor-specific styles

.kiro/specs/meeting-management-app/
├── design.md                  # Full architecture documentation
├── requirements.md            # 12 detailed requirements
└── tasks.md                   # 20-phase implementation plan
```

## Core Data Models

**Location:** `src/types.ts`

### Meeting
```typescript
interface Meeting {
  id: string;              // Timestamp-based unique ID
  title: string;           // Editable title
  date: string;            // Meeting date
  content: string;         // Rich HTML from TipTap
  notes: string;           // Additional notes
  attendees: string[];     // Attendee list
  nextTimeNotes?: string;  // Prep for next meeting
  group?: string;          // Group assignment
  isDivider?: boolean;     // Visual divider flag
  subDivider?: string;     // Sub-group organization
  sortOrder?: number;      // Custom sort position
  isArchived?: boolean;    // Archive status
  createdAt: number;       // Creation timestamp
  updatedAt: number;       // Last modification timestamp
}
```

### VirtualDuplicate
```typescript
interface VirtualDuplicate {
  id: string;                  // Unique virtual ID
  originalMeetingId: string;   // Reference to original meeting
  displayTitle: string;        // Custom display title
  group?: string;              // Virtual group assignment
  sortOrder: number;           // Virtual sort position
  createdAt: number;           // Creation timestamp
}
```

### ActionItem
```typescript
interface ActionItem {
  id: string;              // Unique identifier
  text: string;            // Action item description
  completed: boolean;      // Completion status
  meetingId: string;       // Associated meeting ID
  series?: string;         // Optional series grouping
  createdAt: string;       // Creation timestamp
  completedAt?: string;    // Completion timestamp
}
```

### MemoryBankConfig
```typescript
interface MemoryBankConfig {
  meetingId: string | null;      // ID of the Memory Bank meeting
  lastUpdateTimestamp: number;   // Last successful update time
  updateHistory: UpdateEntry[];  // History of updates
}
```

## Key Files to Know

### Core Application Files
- **`src/App.tsx`** - Root state management, CRUD operations, keyboard shortcuts
- **`src/types.ts`** - All TypeScript interfaces (Meeting, ActionItem, VirtualDuplicate, etc.)
- **`src/services/storage.ts`** - All IndexedDB operations (save/load meetings, action items, config)
- **`src/services/ai.ts`** - AI service integration and API calls

### Main Components
- **`src/components/MeetingList.tsx`** - Sidebar with groups, drag-and-drop, virtual duplicates
- **`src/components/Editor.tsx`** - TipTap rich text editor with auto-save
- **`src/components/RightNav.tsx`** - Action items display, export/import, archive controls
- **`src/components/MeetingTabs.tsx`** - Multi-tab meeting management

### Configuration
- **`vite.config.ts`** - Vite build configuration with AI API proxy
- **`tailwind.config.js`** - Tailwind CSS customization
- **`.env.example`** - Environment variable template

## Important Conventions & Patterns

### Action Item Extraction
- Action items are automatically extracted from meeting content
- Pattern: Lines starting with `"AI:"` prefix (case-sensitive)
- Extracted in real-time as user types
- Managed in App component, displayed in RightNav

### Auto-save Behavior
- 500ms debounce on all content changes
- Saves to IndexedDB automatically
- No manual save button needed
- Updates `updatedAt` timestamp on each save

### Virtual Duplicates
- Allows same meeting to appear in multiple groups
- Creates reference (VirtualDuplicate) not a copy
- Edits to original meeting reflect in all virtual instances
- Used for cross-functional meeting organization

### Drag and Drop
- Uses react-beautiful-dnd library
- Supports reordering within groups
- Supports moving between groups
- Updates sortOrder field automatically

### Keyboard Shortcuts
- `\` - Open global search dialog
- `Ctrl+,` - Open AI configuration settings
- Editor shortcuts: Standard TipTap/rich text shortcuts

### Data Persistence Strategy
- **Primary storage:** IndexedDB via idb-keyval
- **Keys used:**
  - `meetings` - Array of Meeting objects
  - `actionItems` - Array of ActionItem objects
  - `virtualDuplicates` - Array of VirtualDuplicate objects
  - `aiConfig` - AI configuration settings
  - `memoryBankConfig` - Memory bank configuration
- **Backup:** Export to JSON for manual backup
- **Import:** Validates JSON structure before import

## Common Patterns in Codebase

### State Updates
```typescript
// Always update both meetings and save to IndexedDB
const updatedMeetings = meetings.map(m =>
  m.id === meetingId ? { ...m, content: newContent, updatedAt: Date.now() } : m
);
setMeetings(updatedMeetings);
saveMeetings(updatedMeetings);
```

### Debounced Auto-save
```typescript
// Use useCallback with debounce
const debouncedSave = useMemo(
  () => debounce((meetings: Meeting[]) => saveMeetings(meetings), 500),
  []
);
```

### Action Item Extraction
```typescript
// Extract lines starting with "AI:"
const actionItemPattern = /^AI:\s*(.+)$/gm;
const matches = content.matchAll(actionItemPattern);
```

## Environment Configuration

**Location:** `.env` (create from `.env.example`)

```env
# AI API key (optional - can also be set in app via Ctrl+,)
VITE_AI_API_KEY=your_api_key_here

# AI API endpoint (optional - defaults to /api/ai)
VITE_AI_API_ENDPOINT=/api/ai

# AI API target URL for Vite proxy
VITE_AI_API_TARGET=http://localhost:3001
```

**Priority:** Environment variables override app settings

## Testing & Development

### Running the App
```bash
npm install
npm run dev
```

### Build
```bash
npm run build
```

### Linting
```bash
npm run lint
```

## Common Pitfalls to Avoid

1. **Don't forget to update timestamps** - Always set `updatedAt: Date.now()` when modifying meetings
2. **Don't skip debouncing** - Use debounced saves to avoid excessive IndexedDB writes
3. **Virtual duplicates are references** - Don't try to edit virtual duplicate content directly, edit the original
4. **Action item extraction is case-sensitive** - Must use "AI:" not "ai:" or "Ai:"
5. **IndexedDB is async** - Always await storage operations
6. **Image compression** - Editor automatically compresses pasted images to prevent storage bloat

## Performance Considerations

- **Auto-save debouncing:** 500ms to batch rapid changes
- **Image compression:** Automatic compression on paste
- **Incremental saves:** Only save changed data when possible
- **Memory management:** Proper cleanup of timeouts and event listeners
- **Large datasets:** App tested with 1000+ meetings

## Security & Privacy

- **No server communication:** All data stays local
- **No tracking or analytics:** Complete privacy
- **XSS prevention:** TipTap sanitizes HTML
- **Input validation:** All imports validated before processing
- **User control:** Complete control over data export/import

## Detailed Documentation

For comprehensive details, see:
- `.kiro/specs/meeting-management-app/design.md` - Full architecture and design decisions
- `.kiro/specs/meeting-management-app/requirements.md` - 12 detailed requirements with acceptance criteria
- `.kiro/specs/meeting-management-app/tasks.md` - 20-phase implementation plan
- `README.md` - Environment setup and basic info

## Quick Reference: Common Tasks

### Adding a new feature
1. Update `src/types.ts` if new data structures needed
2. Add storage functions to `src/services/storage.ts`
3. Create component in `src/components/`
4. Update `src/App.tsx` for state management
5. Test with multiple meetings and edge cases

### Debugging storage issues
1. Open browser DevTools → Application → IndexedDB
2. Check `keyvaluepairs` store for saved data
3. Verify JSON structure matches interfaces in `src/types.ts`

### Adding keyboard shortcuts
1. Add to App.tsx `useEffect` with keyboard event listener
2. Update documentation in `.kiro/specs/` if user-facing

### Modifying the editor
1. Editor logic in `src/components/Editor.tsx`
2. TipTap configuration and extensions
3. Styles in `src/styles/editor.css`

---

**Last Updated:** 2026-01-13
**App Version:** Based on latest commit (2383f5f - Added memory bank capability)
