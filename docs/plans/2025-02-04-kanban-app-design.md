# Kanban Board App Design

## Overview

A local desktop Kanban board app with project switching and iTerm2 integration.

## Features

1. **5-column Kanban board** with drag-and-drop: Backlog → Todo → In Progress → Review → Done
2. **Project tabs** for switching between multiple projects
3. **iTerm2 integration** - Open terminal at project's folder path
4. **Task details** - Description, due date, labels
5. **Color-coded labels** - Bug (red), Feature (green), Urgent (orange), etc.
6. **Dark mode UI**

## Tech Stack

- **Electron** - Desktop app shell
- **React + TypeScript** - UI components
- **Tailwind CSS** - Styling (dark mode)
- **@dnd-kit** - Drag-and-drop
- **Zustand** - State management

## Architecture

```
┌─────────────────────────────────────────────────┐
│  [Project A] [Project B] [+]     [⚙️]          │  ← Tab bar
├─────────────────────────────────────────────────┤
│  Project A          [📁 Open in iTerm2]        │  ← Header
├─────────────────────────────────────────────────┤
│ Backlog │ Todo │ In Progress │ Review │ Done   │
│─────────│──────│─────────────│────────│────────│
│ [Card]  │[Card]│   [Card]    │ [Card] │ [Card] │
│ [Card]  │      │             │        │        │
└─────────────────────────────────────────────────┘
```

## Data Model

Location: `~/.kanban/data.json`

```json
{
  "projects": [
    {
      "id": "proj-1",
      "name": "My App",
      "path": "/Users/jackieqin/projects/my-app",
      "order": 0
    }
  ],
  "tasks": [
    {
      "id": "task-1",
      "projectId": "proj-1",
      "title": "Fix login bug",
      "description": "Users can't login with Google OAuth",
      "column": "in-progress",
      "labels": ["bug"],
      "dueDate": "2025-02-10",
      "order": 0
    }
  ],
  "labels": [
    { "id": "bug", "name": "Bug", "color": "#ef4444" },
    { "id": "feature", "name": "Feature", "color": "#22c55e" },
    { "id": "urgent", "name": "Urgent", "color": "#f97316" }
  ]
}
```

## UI Components

### Tab Bar
- Horizontal project tabs
- `[+]` button to add project (name + folder path)
- Right-click to rename/delete
- Drag to reorder

### Project Header
- Current project name
- `[Open in iTerm2]` button

### Kanban Board
- 5 columns with task counts
- `[+ Add task]` at bottom of each column

### Task Card
- Title, label dots, due date
- Drag to move/reorder
- Click to open detail modal

### Task Detail Modal
- Edit title, description
- Multi-select labels
- Date picker for due date
- Delete button

### Settings Modal
- Manage labels (add/edit/delete, color picker)

## File Structure

```
/Kanban
├── package.json
├── electron/
│   ├── main.ts           # Electron main process
│   ├── preload.ts        # Bridge to renderer
│   └── iterm.ts          # iTerm2 launch logic
├── src/
│   ├── main.tsx          # React entry
│   ├── App.tsx           # Root component
│   ├── components/
│   │   ├── TabBar.tsx
│   │   ├── ProjectHeader.tsx
│   │   ├── KanbanBoard.tsx
│   │   ├── Column.tsx
│   │   ├── TaskCard.tsx
│   │   ├── TaskModal.tsx
│   │   ├── AddProjectModal.tsx
│   │   └── SettingsModal.tsx
│   ├── store/
│   │   └── useStore.ts   # Zustand store
│   ├── lib/
│   │   └── storage.ts    # Read/write JSON file
│   └── styles/
│       └── globals.css   # Tailwind + dark theme
├── tailwind.config.js
└── electron-builder.json # Build config for .app
```

## iTerm2 Integration

Uses AppleScript via Electron:

```javascript
osascript -e 'tell application "iTerm2"
  create window with default profile
  tell current session of current window
    write text "cd /path/to/project"
  end tell
end tell'
```

## Build Output

Creates `Kanban.app` that can be dragged to `/Applications` folder.
