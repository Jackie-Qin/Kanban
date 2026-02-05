# Developer Workspace Design

**Date:** 2026-02-04
**Status:** Approved
**Scope:** Transform Kanban app into a full developer workspace with dockable panels, embedded editor, and Git integration

---

## Overview

Enhance the Kanban application from a simple task board into a comprehensive developer workspace. Each project becomes a workspace with dockable panels for task management, code editing, terminal access, Git operations, and file browsing.

### Goals
- Personal productivity optimized for solo developers
- Tight Git integration for developer workflow
- Polished UX with flexible, customizable layouts

### Non-Goals
- Team collaboration / multi-user sync
- Full IDE feature parity (debugging, extensions, etc.)

---

## Architecture

### Panel System

Using **Dockview** (v4.13.1+) for the docking layout manager.

Each project workspace contains 5 dockable panels:

| Panel | Purpose | Key Features |
|-------|---------|--------------|
| **Kanban** | Task board | 5-column board with drag-and-drop |
| **Editor** | Code editing | Monaco editor, multi-tab, syntax highlighting |
| **Terminal** | Shell access | xterm.js, multiple terminal tabs |
| **Git** | Version control | Branch management, commit history, diffs |
| **Directory** | File browser | Tree view with file operations |

### Default Layout

```
┌─────────────────────────────────────────────────┐
│  Project Tabs (Venus, venus-website, Kanban)    │
├──────────┬──────────────────────────────────────┤
│          │                                      │
│ Directory│         Kanban / Editor              │
│   +Git   │         (center, tabbed)             │
│  (left)  │                                      │
│          ├──────────────────────────────────────┤
│          │           Terminal                   │
│          │           (bottom)                   │
└──────────┴──────────────────────────────────────┘
```

Users can drag any panel to any dock position (left, right, bottom, center). Layout persists per project in `~/.kanban/data.json`.

---

## Feature Details

### 1. Git Status in Project Header

Display at-a-glance git information in the project header:

```
Venus                              🌿 main  ↑2 ↓1  ●3 modified
/Users/jackieqin/Desktop/Venus
```

**Elements:**
- `🌿 main` - Current branch name
- `↑2 ↓1` - Commits ahead/behind remote
- `●3 modified` - Uncommitted changes count

**Implementation:**
- Use `simple-git` npm package for Git operations
- Poll every 30 seconds or on window focus
- Click to open Git panel

---

### 2. Git Panel

Full Git management panel:

```
┌─ Git ─────────────────────────────┐
│ 🌿 main                     ↻     │
│ ↑2 ahead  ↓1 behind  ●3 modified  │
├───────────────────────────────────┤
│ Branches                   [+ New]│
│  ● main                           │
│    feature/payment-shop           │
│    feature/map-search             │
├───────────────────────────────────┤
│ Recent Commits                    │
│  a1b2c3d  Fix map icon bug   2h   │
│  d4e5f6g  Add payment flow   1d   │
│  g7h8i9j  Initial commit     3d   │
└───────────────────────────────────┘
```

**Branch Operations:**
- View all local branches
- Create new branch (with base branch selection)
- Switch branches (checkout)
- Delete branch (with confirmation)

**Commit List:**
- Shows recent commits on current branch
- Displays: short hash, message, relative time
- Click to expand and view details

---

### 3. Commit Diff Viewer

When clicking a commit, show detailed diff:

```
┌─ Commit: a1b2c3d ─────────────────────────────┐
│ Add Stripe integration                        │
│                                               │
│ Author: Jackie Qin                            │
│ Date: Feb 4, 2026, 10:32 AM                   │
│                                               │
│ Files changed (3):                            │
│ ┌───────────────────────────────────────────┐ │
│ │ src/payments/stripe.ts      +98  -2   [👁] │ │
│ │ src/routes/checkout.ts      +32  -8   [👁] │ │
│ │ package.json                +12  -2   [👁] │ │
│ └───────────────────────────────────────────┘ │
└───────────────────────────────────────────────┘
```

**File Diff View:**
- Click [👁] to view syntax-highlighted diff
- Unified or side-by-side view toggle
- "Open in Editor" button to edit the file

---

### 4. Branch Per Task

**Creating a Branch from Task:**

Hover on task card shows git icon. Click to open dialog:

```
┌─ Create Branch ─────────────────────┐
│                                     │
│ feature/payment-for-shop            │
│ ─────────────────────────────       │
│ Auto-generated from task title      │
│                                     │
│ Base branch: [main ▼]               │
│                                     │
│        [Cancel]  [Create & Checkout]│
└─────────────────────────────────────┘
```

**Branch Name Generation:**
- Prefix: `feature/`
- Slugify task title: lowercase, replace spaces with hyphens
- Example: "Payment for shop" → `feature/payment-for-shop`

**Task Card with Branch:**

```
┌─────────────────────────────┐
│ [Feature]                   │
│ Payment for shop            │
│ 🌿 feature/payment-for-shop │
│ ○ 2h ago                    │
└─────────────────────────────┘
```

- Click branch badge to checkout that branch
- Shows toast notification on branch switch

**Data Model Change:**

```typescript
interface Task {
  id: string
  projectId: string
  title: string
  description: string
  column: ColumnId
  labels: string[]
  dueDate: string | null
  createdAt: string
  order: number
  branch?: string  // NEW: linked branch name
}
```

---

### 5. Commit History in Task Modal

Task modal gains a "Commits" tab when task has a linked branch:

```
┌─ Payment for shop ──────────────────────────────┐
│ [Details]  [Commits]                            │
├─────────────────────────────────────────────────┤
│ 3 commits on feature/payment-for-shop           │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ a1b2c3d  Add Stripe integration     2h ago  │ │
│ │          +142 -12  3 files                  │ │
│ └─────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────┐ │
│ │ d4e5f6g  Setup payment routes       5h ago  │ │
│ │          +89 -4   2 files                   │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

**Commit Entry (Expanded):**
- Full commit message
- Author and date
- List of changed files with diff stats
- Click file to view diff or open in editor

---

### 6. Directory Panel

File tree browser for the project:

```
┌─ Directory ─────────────────┐
│ 🔍 Search files...          │
├─────────────────────────────┤
│ ▼ 📁 src                    │
│   ▼ 📁 components           │
│       📄 App.tsx            │
│       📄 Column.tsx         │
│       📄 TaskCard.tsx       │
│   ▶ 📁 store                │
│   📄 main.tsx               │
│ ▶ 📁 electron               │
│ 📄 package.json             │
│ 📄 README.md                │
└─────────────────────────────┘
```

**Interactions:**
- Single-click: Preview file (temporary tab in editor)
- Double-click: Open file (permanent tab)
- Right-click context menu:
  - New File
  - New Folder
  - Rename
  - Delete
  - Copy Path

**Features:**
- Search/filter box
- Collapse/expand folders
- Show/hide hidden files toggle
- Refresh button

---

### 7. Editor Panel

Monaco-based code editor:

```
┌─ Editor ────────────────────────────────────────┐
│ [App.tsx ●] [Column.tsx] [+ ]                   │
├─────────────────────────────────────────────────┤
│  1 │ import { useState } from 'react'           │
│  2 │ import { useStore } from './store/useStore'│
│  3 │                                            │
│  4 │ export default function App() {            │
│  5 │   const { projects } = useStore()          │
│  ...                                            │
└─────────────────────────────────────────────────┘
```

**Features:**
- Multi-tab interface
- Unsaved indicator (● in tab)
- Syntax highlighting for: TypeScript, JavaScript, JSON, CSS, HTML, Markdown, Python, Go, Rust, etc.
- Line numbers
- Minimap (toggleable)
- Find & Replace (Cmd+F, Cmd+H)
- Go to Line (Cmd+G)
- Quick file open (Cmd+P)

**Keyboard Shortcuts:**
- `Cmd+S` - Save file
- `Cmd+W` - Close tab
- `Cmd+P` - Quick file open
- `Cmd+F` - Find
- `Cmd+G` - Go to line

---

## Data Persistence

### Layout Storage

Add to `~/.kanban/data.json`:

```typescript
interface AppData {
  projects: Project[]
  tasks: Task[]
  labels: Label[]
  activeProjectId: string | null
  layouts: {
    [projectId: string]: DockviewLayoutState  // Dockview serialized layout
  }
}
```

### Editor State

Per-project editor state (optional, for later):

```typescript
interface EditorState {
  openFiles: string[]       // Paths of open tabs
  activeFile: string | null // Currently focused tab
}
```

---

## Implementation Phases

### Phase 1: Dockable Panel Foundation

**Goal:** Integrate Dockview and convert existing UI to panels

**Tasks:**
1. Install Dockview (`npm install dockview`)
2. Create `WorkspaceLayout` component wrapping Dockview
3. Convert `KanbanBoard` into a Dockview panel
4. Convert `TerminalPanel` into a Dockview panel
5. Add placeholder panels for Editor, Git, Directory
6. Implement layout persistence (save/load per project)
7. Add panel toggle buttons in header or toolbar

**Deliverables:**
- Draggable, dockable panels
- Layout saves and restores on project switch

---

### Phase 2: Directory + Editor

**Goal:** Functional file browser and code editor

**Tasks:**
1. Build `DirectoryPanel` component
   - Read directory tree via Electron IPC
   - Render collapsible tree view
   - Handle click events (preview/open)
   - Implement context menu (new, rename, delete)
2. Integrate Monaco Editor
   - Install `@monaco-editor/react`
   - Create `EditorPanel` component with tab management
   - Wire up file open from Directory panel
   - Implement save (Cmd+S → write file via IPC)
3. Connect Directory ↔ Editor
   - Single-click preview, double-click open
   - Open from Git diffs

**Deliverables:**
- Working file browser
- Working code editor with tabs
- Files can be created, edited, saved, deleted

---

### Phase 3: Git Integration

**Goal:** Full Git awareness and branch-per-task workflow

**Tasks:**
1. Install `simple-git` for Git operations
2. Build Git IPC handlers in Electron main process:
   - `git:status` - branch, changes, ahead/behind
   - `git:branches` - list branches
   - `git:log` - commit history
   - `git:diff` - file diffs
   - `git:checkout` - switch branch
   - `git:createBranch` - create and checkout
3. Add Git status to `ProjectHeader`
4. Build `GitPanel` component:
   - Branch list with switch/create/delete
   - Recent commits list
   - Commit detail modal with file diffs
5. Implement branch-per-task:
   - Add branch field to Task type
   - Add "Create Branch" button/modal on TaskCard
   - Display branch badge on TaskCard
   - Checkout on badge click
6. Add Commits tab to `TaskModal`:
   - Fetch commits for task's branch
   - Display with diff viewer

**Deliverables:**
- Git status always visible
- Full branch management
- Commit history with diffs
- Tasks linked to branches

---

## Dependencies to Add

```json
{
  "dependencies": {
    "dockview": "^4.13.1",
    "@monaco-editor/react": "^4.6.0",
    "simple-git": "^3.22.0"
  }
}
```

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Dockview learning curve | Medium | Follow official examples, start simple |
| Monaco bundle size | Low | Use lazy loading, tree-shake languages |
| Git operations blocking UI | High | Run all git ops in Electron main process, use async IPC |
| Large repo performance | Medium | Limit commit history fetch, paginate file tree |
| Layout state corruption | Low | Validate on load, fallback to default layout |

---

## Future Enhancements (Out of Scope)

- Git staging / commit from UI
- Git push / pull
- Merge conflict resolution
- GitHub issues sync
- Multiple editor splits
- Search across files (Cmd+Shift+F)
- Extensions / plugins

---

## Appendix: Dockview Integration

Basic setup pattern:

```tsx
import { DockviewReact, DockviewReadyEvent } from 'dockview'

const components = {
  kanban: KanbanPanel,
  editor: EditorPanel,
  terminal: TerminalPanel,
  git: GitPanel,
  directory: DirectoryPanel,
}

function Workspace({ projectId }: { projectId: string }) {
  const onReady = (event: DockviewReadyEvent) => {
    // Load saved layout or create default
    const saved = loadLayout(projectId)
    if (saved) {
      event.api.fromJSON(saved)
    } else {
      event.api.addPanel({ id: 'kanban', component: 'kanban' })
      event.api.addPanel({ id: 'terminal', component: 'terminal', position: { direction: 'below' } })
      event.api.addPanel({ id: 'directory', component: 'directory', position: { direction: 'left' } })
    }
  }

  return (
    <DockviewReact
      components={components}
      onReady={onReady}
      className="dockview-theme-dark"
    />
  )
}
```

---

*Design approved and ready for implementation.*
