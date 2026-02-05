# iTerm2-Style Terminal Design

**Date:** 2026-02-04
**Status:** Approved

## Overview

Redesign the terminal panel to match iTerm2's visual style more closely, including color palette, tab bar design, and functional keyboard shortcuts.

## Changes

### 1. Color Palette (iTerm2 Defaults)

**Background colors:**
- Tab bar: `rgba(40, 42, 46, 0.95)` with `backdrop-filter: blur(12px)`
- Terminal background: `#1d1f21`
- Active tab: `rgba(255, 255, 255, 0.08)`
- Borders: `rgba(255, 255, 255, 0.1)` (subtle, not harsh)

**Terminal theme (xterm):**
```javascript
{
  background: '#1d1f21',
  foreground: '#c7c7c7',
  cursor: '#c7c7c7',
  cursorAccent: '#1d1f21',
  selectionBackground: '#264f78',
  selectionForeground: '#ffffff',
  // ANSI colors - iTerm2 defaults
  black: '#000000',
  red: '#c91b00',
  green: '#00c200',
  yellow: '#c7c400',
  blue: '#0082ff',
  magenta: '#c930c7',
  cyan: '#00c5c7',
  white: '#c7c7c7',
  brightBlack: '#767676',
  brightRed: '#de382b',
  brightGreen: '#39c12c',
  brightYellow: '#e5bf00',
  brightBlue: '#4083ff',
  brightMagenta: '#de38c4',
  brightCyan: '#3fc6c8',
  brightWhite: '#ffffff'
}
```

### 2. Tab Bar Design

**Styling:**
- Height: 36px
- Background: Semi-transparent with backdrop blur (vibrancy effect)
- No bottom border - use subtle box-shadow instead
- Tabs left-aligned, add button after tabs, close button far right

**Tab format:**
```
Terminal 1  ⌘1
```
- No icon
- Name on left, dimmed shortcut on right
- Close button (×) appears on hover only

**Active vs inactive:**
- Active: Light background highlight, white text
- Inactive: Transparent, muted text (`#8e8e93`)

### 3. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘1` | Switch to Terminal 1 |
| `⌘2` | Switch to Terminal 2 |
| `⌘3` | Switch to Terminal 3 |

- Only active when terminal panel is visible
- No-op if target terminal doesn't exist
- Switching focuses the terminal for immediate typing

### 4. Files to Modify

1. **`src/components/Terminal.tsx`**
   - Update xterm theme with iTerm2 colors
   - Change background color

2. **`src/components/TerminalPanel.tsx`**
   - Redesign tab bar styling (translucent + blur)
   - Update tab design (remove icon, add shortcut label)
   - Add keyboard event listener for ⌘1/⌘2/⌘3
   - Update active/inactive tab styles

3. **`src/styles/globals.css`**
   - Ensure backdrop-filter works properly

## What Stays the Same

- Drag-to-resize functionality
- Max 3 terminals limit
- Split view for multiple terminals
- PTY creation/management logic
- Terminal naming ("Terminal 1", "Terminal 2", "Terminal 3")
