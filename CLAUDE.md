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
  - `components/` - UI components
  - `components/panels/` - Dockview panel components (TerminalDockPanel, etc.)
  - `store/` - Zustand state management
- `electron/` - Electron main process
  - `main.ts` - Main process entry
  - `preload.ts` - Preload script for IPC
  - `pty.ts` - Terminal PTY management
- `release/` - Built artifacts (DMG, ZIP)
