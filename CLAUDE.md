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
