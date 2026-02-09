# Kanban Project

Electron-based Kanban board application with integrated terminal support.

## Tech Stack

- **Frontend:** React, TypeScript, Tailwind CSS, Dockview (panel layout)
- **Backend:** Electron, node-pty (terminal emulation)
- **Build:** Vite, electron-builder

## Development

```bash
npm run dev      # Start development server
npm run build    # Build for production
```

## Release Workflow

When updating the release:

1. **Bump version** in `package.json`
2. **Commit changes** with message format: `Description (vX.X.X)`
3. **Build the release:**
   ```bash
   npm run build
   ```
4. **Push and create GitHub release:**
   ```bash
   git push && gh release create vX.X.X \
     release/Kanban-X.X.X-arm64.dmg \
     release/Kanban-X.X.X-arm64-mac.zip \
     --title "vX.X.X" \
     --notes "Release notes here"
   ```

Note: The app uses GitHub API to check for updates (no auto-update). Users must manually download and run `xattr -dr com.apple.quarantine /Applications/Kanban.app` after installation.

## Key Architecture Rules

- **Project path is the single source of truth** - The `projects.path` column has a UNIQUE constraint. `addProject` checks for an existing project at the same path (in-memory, then DB) before creating a new one. If found, it reuses the existing project ID so tasks stay connected. This prevents orphaned tasks from project re-creation.
- **Terminal should never refresh** - Terminals persist across project switches. The `TerminalDockPanel` keeps PTY processes alive by rendering all project terminals and hiding inactive ones with CSS visibility.
- **Git panel must handle project switching reliably** - The `GitPanel` uses both React params and dockview `onDidParametersChange` API to detect project switches. Stale async responses are guarded by comparing `activePathRef.current` against the path at fetch start. All state is cleared on project switch.
- **Git panel polls for working tree changes** - The `.git` watcher only detects index/ref changes (commits, staging). Working tree edits (file saves) require a 3-second polling interval via `setInterval(fetchData, 3000)`.
- **Git changed files must use `status.files` directly** - Do NOT use simple-git's convenience arrays (`status.staged`, `status.modified`, `status.created`, etc.) — they are unreliable. `status.modified` includes index-modified files even when the working tree is clean, causing phantom duplicates. Instead, iterate `status.files` and check `f.index` / `f.working_dir` columns directly. A file can still appear in both staged and unstaged lists when it genuinely has both index and working tree changes (e.g., `MM` status).
- **Git branch listing must not fetch** - `git-branches` must not run `git fetch --prune` before listing. This causes slowdowns and failures when there's no remote or network issues.
- **Git watcher ref-counting must only increment on success** - `startGitWatcher` must only increment the ref counter after `fs.watch()` succeeds. If `.git` doesn't exist or the watch throws, do not increment — otherwise the counter leaks and watchers are never cleaned up.
- **Git panel fetchData must use a generation counter** - The 3-second polling and explicit actions (stage, commit, etc.) both call `fetchData`. Without a generation counter (`fetchGenRef`), a stale polling response can overwrite fresh results from an explicit action. Always increment and check the counter before applying results.
- **Editor must reject large files** - Files over 5MB must not be opened in Monaco Editor. The `fs-read-file` handler checks file size and returns `null` for files exceeding the limit. Without this, large log/debug files freeze the entire app.

## Project Structure

- `src/` - React frontend
  - `components/` - UI components (each panel wrapped in `PanelErrorBoundary`)
  - `components/panels/` - Dockview panel components (TerminalDockPanel, etc.)
  - `components/PanelErrorBoundary.tsx` - Error boundary for panel crash isolation
  - `store/` - Zustand state management
  - `lib/eventBus.ts` - Typed cross-panel event emitter
  - `lib/projectCache.ts` - In-memory git/directory data cache
- `electron/` - Electron main process
  - `main.ts` - App lifecycle, window creation, handler registration (~150 lines)
  - `shared.ts` - Shared state (paths, settings, mainWindow ref)
  - `preload.ts` - Preload script for IPC
  - `pty.ts` - Terminal PTY management
  - `menu.ts` - Application menu builder
  - `updater.ts` - GitHub release update checker
  - `handlers/data.ts` - Data persistence, auto-sync, settings IPC handlers
  - `handlers/git.ts` - Git operations + watcher IPC handlers
  - `handlers/fs.ts` - File system + dialog IPC handlers
  - `handlers/search.ts` - File/text search IPC handlers
  - `handlers/attachments.ts` - Attachment management IPC handlers
  - `handlers/terminal-state.ts` - Terminal state/buffer persistence IPC handlers
  - `database.ts` - SQLite persistence layer (`better-sqlite3`, WAL mode)
- `release/` - Built artifacts (DMG, ZIP)

## Architecture Roadmap

The following improvements are planned, in priority order:

### 1. ~~Migrate from JSON to SQLite (`better-sqlite3`)~~ (DONE)
- Data stored in `~/.kanban/kanban.db` (SQLite, WAL mode). Auto-migrates from `data.json` on first launch (backs up to `data.json.backup`). Schema includes `schema_version` table for future migrations.
- **Rule:** After migration, every data mutation should be a targeted SQL operation — never rewrite the entire dataset.

### 2. ~~Split `electron/main.ts` into domain modules~~ (DONE)
- Extracted into `electron/handlers/{data,git,fs,search,attachments,terminal-state}.ts`, `electron/menu.ts`, `electron/updater.ts`, `electron/shared.ts`. `main.ts` is now ~150 lines.
- **Rule:** New IPC handlers must go in the appropriate domain module, not in `main.ts`.

### 3. ~~Data versioning and migrations~~ (DONE)
- `schema_version` table in SQLite, initialized at version 1. JSON-to-SQLite migration runs automatically on first launch with backup.
- **Rule:** Any schema change (new field, renamed field, structural change) requires a numbered migration in `database.ts`.

### 4. ~~Typed event bus for inter-panel communication~~ (DONE)
- Implemented in `src/lib/eventBus.ts` with typed `EventMap`. All panels migrated.
- **Rule:** All cross-panel communication must go through `eventBus`. No direct `CustomEvent` usage for app events.

### 5. ~~Async search (ripgrep)~~ (DONE)
- Search uses `rg` (ripgrep) via `execFile` when available, with fallback to the original sync implementation. Ripgrep auto-detected at `/opt/homebrew/bin/rg`, `/usr/local/bin/rg`, or `/usr/bin/rg`.
- **Rule:** No synchronous file I/O in search handlers when ripgrep is available.

### 6. ~~React error boundaries per panel~~ (DONE)
- Implemented `PanelErrorBoundary` component. All 5 panels wrapped via `withErrorBoundary()` in `WorkspaceLayout.tsx`.
- **Rule:** Every panel registered in `WorkspaceLayout.tsx` must be wrapped in `PanelErrorBoundary`.

### 7. ~~Test infrastructure and core coverage~~ (DONE)
- Vitest + @testing-library/react. 28 tests covering store mutations (projects, tasks, labels, layouts), event bus, and targeted persistence. Run with `npm test`.
- **Rule:** New store actions and IPC handlers must have accompanying tests.

### 8. ~~Targeted persistence (eliminate full-rewrite bottleneck)~~ (DONE)
- Every store mutation now calls a dedicated IPC handler (`db-save-layout`, `db-set-app-state`, `db-upsert-project`, etc.) that executes a single SQL statement. The old `saveData`/`saveAllData` full-table nuke-and-rewrite has been removed entirely.
- **Rule:** Every store mutation must persist via its own targeted IPC handler in `electron/handlers/data.ts`. NEVER rewrite entire tables. See `docs/design/targeted-persistence.md` for details.
- **Rule:** Batch operations (reorderProjects, reorderTasks) must use `db-batch-upsert-*` handlers that wrap multiple upserts in a single transaction.
