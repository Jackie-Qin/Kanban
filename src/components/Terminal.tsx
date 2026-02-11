import { useEffect, useRef, useCallback, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { SerializeAddon } from '@xterm/addon-serialize'
import { electron } from '../lib/electron'
import { useTerminalSettings } from '../store/useTerminalSettings'
import { getThemeByName } from '../lib/terminalThemes'
import { eventBus } from '../lib/eventBus'
import { useHotkeySettings } from '../store/useHotkeySettings'

const IDLE_TIMEOUT_MS = 5000       // 5s of silence after activity = "done"
const MIN_ACTIVE_DURATION_MS = 10000 // Must have 10s+ of output to trigger notification

interface TerminalProps {
  terminalId: string
  projectPath: string
  terminalName: string
  isActive: boolean
  isVisible: boolean
  onSelect: () => void
}

export default function Terminal({
  terminalId,
  projectPath,
  terminalName,
  isActive,
  isVisible,
  onSelect
}: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const webglAddonRef = useRef<WebglAddon | null>(null)
  const serializeAddonRef = useRef<SerializeAddon | null>(null)
  const ptyCreatedRef = useRef(false)
  const activityStartRef = useRef(0)
  const lastDataRef = useRef(0)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isOutputActiveRef = useRef(false)
  // Explicit user-scroll tracking: true only when the user intentionally
  // scrolled up.  Set by xterm's onScroll event, cleared when viewport
  // reaches the bottom again.  This replaces the fragile
  // `viewportY >= baseY` snapshot that could give false negatives after
  // buffer reflow (the root cause of the split-view "jump to top" bug).
  const userScrolledUpRef = useRef(false)
  const isFittingRef = useRef(false)
  const { themeName, fontSize, fontFamily } = useTerminalSettings()

  // Fit terminal to container, scroll to bottom unless user scrolled up
  const fitTerminal = useCallback(() => {
    if (fitAddonRef.current && xtermRef.current && terminalRef.current) {
      const { offsetWidth, offsetHeight } = terminalRef.current

      if (offsetWidth >= 50 && offsetHeight >= 50) {
        try {
          const term = xtermRef.current

          isFittingRef.current = true
          fitAddonRef.current.fit()
          isFittingRef.current = false
          const { cols, rows } = term

          if (ptyCreatedRef.current) {
            electron.ptyResize(terminalId, cols, rows)
          }

          // Always snap to bottom after fit() unless the user has
          // intentionally scrolled up.  Deferred one frame so xterm's
          // internal buffer reflow (triggered by fit()) completes first.
          if (!userScrolledUpRef.current) {
            requestAnimationFrame(() => {
              term.scrollToBottom()
            })
          }
        } catch (e) {
          console.error(`[Terminal] Failed to fit:`, e)
        }
      }
    }
  }, [terminalId])

  // Main initialization — themeName/fontSize intentionally excluded from deps
  useEffect(() => {
    const container = terminalRef.current
    if (!container) return

    // Clear container in case of remount
    container.innerHTML = ''

    // Read current settings at init time
    const state = useTerminalSettings.getState()
    const initTheme = getThemeByName(state.themeName)

    // Initialize xterm
    const xterm = new XTerm({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: state.fontSize,
      fontFamily: `"${state.fontFamily}", Monaco, Menlo, monospace`,
      fontWeight: '500',
      fontWeightBold: '700',
      theme: initTheme.theme
    })

    const fitAddon = new FitAddon()
    xterm.loadAddon(fitAddon)
    xterm.open(container)

    // WebGL renderer: renders block/box characters as filled rects (no gaps)
    const loadWebgl = (term: XTerm) => {
      try {
        const addon = new WebglAddon()
        addon.onContextLoss(() => {
          try { addon.dispose() } catch { /* already disposed */ }
          webglAddonRef.current = null
          // Attempt to recreate after context loss
          setTimeout(() => {
            if (xtermRef.current) loadWebgl(xtermRef.current)
          }, 100)
        })
        term.loadAddon(addon)
        webglAddonRef.current = addon
      } catch {
        // Falls back to canvas renderer if WebGL unavailable
      }
    }
    loadWebgl(xterm)

    // Serialize addon for buffer persistence
    const serializeAddon = new SerializeAddon()
    xterm.loadAddon(serializeAddon)
    serializeAddonRef.current = serializeAddon

    xtermRef.current = xterm
    fitAddonRef.current = fitAddon

    // Track user scroll: set flag when user scrolls away from bottom,
    // clear it when they scroll back down.  This drives fitTerminal's
    // decision to auto-scroll, replacing the old viewportY>=baseY snapshot.
    const scrollDisposable = xterm.onScroll(() => {
      // Ignore scroll events fired during fit() reflow — the buffer
      // rewrap can temporarily set viewportY to 0, which would falsely
      // mark the user as "scrolled up" and prevent auto-scroll.
      if (isFittingRef.current) return
      const buf = xterm.buffer.active
      userScrolledUpRef.current = buf.viewportY < buf.baseY
    })

    // Link provider: clickable [Image #N] references
    const imageLinkDisposable = xterm.registerLinkProvider({
      provideLinks(bufferLineNumber: number, callback) {
        const line = xterm.buffer.active.getLine(bufferLineNumber - 1)
        if (!line) { callback(undefined); return }
        const text = line.translateToString()

        const regex = /\[Image\s*#(\d+)\]/g
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const links: any[] = []
        let match
        while ((match = regex.exec(text)) !== null) {
          const startX = match.index + 1
          const endX = startX + match[0].length - 1
          const imageNum = parseInt(match[1], 10)
          links.push({
            range: { start: { x: startX, y: bufferLineNumber }, end: { x: endX, y: bufferLineNumber } },
            text: match[0],
            decorations: { pointerCursor: true, underline: true },
            activate: async () => {
              const imagePath = await electron.findClaudeImage(imageNum)
              if (imagePath) {
                eventBus.emit('editor:open-file', { path: imagePath, preview: true })
                eventBus.emit('panel:focus', { panelId: 'editor' })
              }
            }
          })
        }
        callback(links.length > 0 ? links : undefined)
      }
    })

    // Link provider: clickable file paths (quoted and unquoted)
    const filePathLinkDisposable = xterm.registerLinkProvider({
      provideLinks(bufferLineNumber: number, callback) {
        const line = xterm.buffer.active.getLine(bufferLineNumber - 1)
        if (!line) { callback(undefined); return }
        const text = line.translateToString()

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const links: any[] = []

        // 1. Quoted paths: '/path/to/file' or "/path/to/file"
        const quotedRegex = /(['"])(\/[^'"]*?)\1/g
        let match
        while ((match = quotedRegex.exec(text)) !== null) {
          const filePath = match[2]
          const startX = match.index + 1 // include the opening quote
          const endX = startX + match[0].length - 1
          links.push({
            range: { start: { x: startX, y: bufferLineNumber }, end: { x: endX, y: bufferLineNumber } },
            text: filePath,
            decorations: { pointerCursor: true, underline: true },
            activate: async () => {
              const exists = await electron.fsExists(filePath)
              if (exists) {
                eventBus.emit('editor:open-file', { path: filePath, preview: true })
                eventBus.emit('panel:focus', { panelId: 'editor' })
              }
            }
          })
        }

        // 2. Unquoted absolute paths (must contain at least 2 slashes)
        const unquotedRegex = /(?:^|(?<=\s))(\/[\w.\-]+(?:\/[\w.\-\u0080-\uffff]+)+)/g
        while ((match = unquotedRegex.exec(text)) !== null) {
          const filePath = match[1]
          const startX = match.index + (match[0].length - match[1].length) + 1
          const endX = startX + filePath.length - 1
          // Skip if overlapping with a quoted link
          const overlaps = links.some((l: { range: { start: { x: number }; end: { x: number } } }) =>
            !(endX < l.range.start.x || startX > l.range.end.x)
          )
          if (!overlaps) {
            links.push({
              range: { start: { x: startX, y: bufferLineNumber }, end: { x: endX, y: bufferLineNumber } },
              text: filePath,
              decorations: { pointerCursor: true, underline: true },
              activate: async () => {
                const exists = await electron.fsExists(filePath)
                if (exists) {
                  eventBus.emit('editor:open-file', { path: filePath, preview: true })
                  eventBus.emit('panel:focus', { panelId: 'editor' })
                }
              }
            })
          }
        }

        callback(links.length > 0 ? links : undefined)
      }
    })

    // Listen for PTY data
    const unsubscribeData = electron.onPtyData(({ terminalId: tid, data }) => {
      if (tid === terminalId && xtermRef.current) {
        xtermRef.current.write(data)

        // Idle detection: track output activity to notify when a long task finishes
        const now = Date.now()
        if (!isOutputActiveRef.current) {
          activityStartRef.current = now
          isOutputActiveRef.current = true
        }
        lastDataRef.current = now
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
        idleTimerRef.current = setTimeout(() => {
          if (isOutputActiveRef.current) {
            const duration = lastDataRef.current - activityStartRef.current
            if (duration >= MIN_ACTIVE_DURATION_MS) {
              const projectName = projectPath.split('/').pop() || projectPath
              eventBus.emit('terminal:activity-done', { terminalId, terminalName, projectName })
            }
            isOutputActiveRef.current = false
          }
        }, IDLE_TIMEOUT_MS)
      }
    })

    // Listen for PTY exit
    const unsubscribeExit = electron.onPtyExit(({ terminalId: tid }) => {
      if (tid === terminalId && xtermRef.current) {
        xtermRef.current.write('\r\n\x1b[33m[Process exited]\x1b[0m\r\n')
      }
    })

    // Intercept app-level shortcuts so xterm doesn't consume them
    xterm.attachCustomKeyEventHandler((e) => {
      if (e.type === 'keydown') {
        const hotkeys = useHotkeySettings.getState()

        // Clear terminal: handle inline since it needs xterm access
        if (hotkeys.matchesEvent('clear-terminal', e)) {
          e.preventDefault()
          xterm.clear()
          userScrolledUpRef.current = false
          xterm.scrollToBottom()
          return false
        }

        // Pass through any other app-level bound hotkeys
        if (hotkeys.matchesAnyAction(e)) {
          return false
        }
      }
      return true
    })

    // Send input to PTY
    const dataDisposable = xterm.onData((data) => {
      if (ptyCreatedRef.current) {
        electron.ptyWrite(terminalId, data)
      }
    })

    // Fit, restore buffer, and create/reconnect PTY after render
    const initTimeout = setTimeout(async () => {
      if (fitAddonRef.current && xtermRef.current) {
        fitAddonRef.current.fit()

        // Check if PTY is already running (survived a window close/reopen)
        const ptyAlive = await electron.ptyExists(terminalId)

        // Restore saved buffer before creating PTY
        try {
          const savedBuffer = await electron.loadTerminalBuffer(terminalId)
          if (savedBuffer && xtermRef.current) {
            xtermRef.current.write(savedBuffer)
            if (!ptyAlive) {
              xtermRef.current.write('\r\n\x1b[90m--- Session restored ---\x1b[0m\r\n')
            }
          }
        } catch {
          // Ignore buffer restore errors
        }

        if (ptyAlive) {
          // Reconnect: flush any output buffered while the window was closed
          ptyCreatedRef.current = true
          const buffered = await electron.ptyReconnect(terminalId)
          if (buffered && xtermRef.current) {
            xtermRef.current.write(buffered)
          }
          electron.ptyResize(terminalId, xtermRef.current!.cols, xtermRef.current!.rows)
        } else if (!ptyCreatedRef.current) {
          // No existing PTY — create a fresh one
          const success = await electron.ptyCreate(terminalId, projectPath)
          if (success) {
            ptyCreatedRef.current = true
            electron.ptyResize(terminalId, xtermRef.current!.cols, xtermRef.current!.rows)
          }
        }

        // Ensure terminal is scrolled to bottom after init/restore
        userScrolledUpRef.current = false
        xtermRef.current?.scrollToBottom()
      }
    }, 100)

    // Handle resize — use rAF to fit on the next frame after layout settles.
    // xterm.resize() is a no-op when cols/rows haven't changed, so per-frame
    // calls during a drag are cheap and keep the terminal in sync with its container.
    let rafId: number | null = null
    const resizeObserver = new ResizeObserver(() => {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(fitTerminal)
    })
    resizeObserver.observe(container)

    return () => {
      clearTimeout(initTimeout)
      if (rafId) cancelAnimationFrame(rafId)
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      resizeObserver.disconnect()
      unsubscribeData()
      unsubscribeExit()
      dataDisposable.dispose()
      scrollDisposable.dispose()
      imageLinkDisposable.dispose()
      filePathLinkDisposable.dispose()

      // Serialize buffer before disposing
      if (serializeAddonRef.current && xterm) {
        try {
          const serialized = serializeAddonRef.current.serialize()
          if (serialized) {
            electron.saveTerminalBuffer(terminalId, serialized)
          }
        } catch {
          // Ignore serialize errors
        }
      }

      // Don't kill PTY on unmount — it stays alive across window close/reopen.
      // PTY is explicitly killed by TerminalDockPanel.closeTerminal() when the user closes a tab.
      ptyCreatedRef.current = false

      // Dispose WebGL addon first to avoid _isDisposed errors during xterm teardown
      if (webglAddonRef.current) {
        try { webglAddonRef.current.dispose() } catch { /* already disposed */ }
        webglAddonRef.current = null
      }

      serializeAddonRef.current = null
      try { xterm.dispose() } catch { /* xterm already disposed */ }
      xtermRef.current = null
      fitAddonRef.current = null
    }
  }, [terminalId, projectPath, fitTerminal])

  // Live-update theme, fontSize, fontFamily without recreating xterm/PTY
  useEffect(() => {
    const xterm = xtermRef.current
    if (!xterm) return
    const t = getThemeByName(themeName)
    xterm.options.theme = t.theme
    xterm.options.fontSize = fontSize
    xterm.options.fontFamily = `"${fontFamily}", Monaco, Menlo, monospace`
    // Re-fit after font change so cols/rows update
    requestAnimationFrame(fitTerminal)
  }, [themeName, fontSize, fontFamily, fitTerminal])

  // Clear WebGL texture atlas and refit when terminal becomes visible.
  // In split view, all terminals are visible but only one is "active" (focused).
  // Without this, non-active terminals show garbled WebGL rendering.
  useEffect(() => {
    if (isVisible && xtermRef.current) {
      if (webglAddonRef.current) {
        try { webglAddonRef.current.clearTextureAtlas() } catch { /* ignore */ }
      }
      fitTerminal()
    }
  }, [isVisible, fitTerminal])

  // Focus when active (separate from visibility to avoid focusing all split-view terminals)
  useEffect(() => {
    if (isActive && xtermRef.current) {
      xtermRef.current.focus()
    }
  }, [isActive])

  const bgColor = getThemeByName(themeName).theme.background || '#14191e'

  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounterRef = useRef(0)

  const acceptsDrag = useCallback((e: React.DragEvent) => {
    return e.dataTransfer.types.includes('application/x-kanban-task') ||
      e.dataTransfer.types.includes('application/x-kanban-file')
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (acceptsDrag(e)) {
      e.preventDefault()
      dragCounterRef.current++
      setIsDragOver(true)
    }
  }, [acceptsDrag])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (acceptsDrag(e)) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  }, [acceptsDrag])

  const handleDragLeave = useCallback(() => {
    dragCounterRef.current--
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0
      setIsDragOver(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current = 0
    setIsDragOver(false)

    if (!ptyCreatedRef.current) return

    // File path drop from directory panel
    const filePath = e.dataTransfer.getData('application/x-kanban-file')
    if (filePath) {
      // Shell-escape the path: wrap in single quotes, escape any internal single quotes
      const escaped = "'" + filePath.replace(/'/g, "'\\''") + "'"
      electron.ptyWrite(terminalId, escaped)
      return
    }

    // Task card drop
    const taskJson = e.dataTransfer.getData('application/x-kanban-task')
    if (!taskJson) return

    try {
      const task = JSON.parse(taskJson) as { title: string; description: string; attachments?: { name: string; path: string; type: string }[] }
      let text = `title: ${task.title}`
      if (task.description) {
        text += `\ndescription: ${task.description}`
      }
      if (task.attachments && task.attachments.length > 0) {
        const paths = task.attachments.map(a => a.path).join(', ')
        text += `\nattachments: ${paths}`
      }
      text += '\n'
      electron.ptyWrite(terminalId, text)
    } catch {
      // Fallback to plain text
      const plain = e.dataTransfer.getData('text/plain')
      if (plain) {
        electron.ptyWrite(terminalId, plain)
      }
    }
  }, [terminalId])

  return (
    <div
      className="h-full w-full flex flex-col min-h-0 relative"
      onClick={onSelect}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className="flex-1 min-h-0 w-full"
        style={{
          padding: '8px 0 0 12px',
          backgroundColor: bgColor
        }}
      >
        <div ref={terminalRef} className="h-full w-full overflow-hidden" />
      </div>
      {/* Drop overlay */}
      {isDragOver && (
        <div className="absolute inset-0 bg-blue-500/10 border-2 border-blue-500 rounded pointer-events-none z-10 flex items-center justify-center">
          <span className="text-blue-400 text-sm font-medium bg-black/60 px-3 py-1.5 rounded">Drop here</span>
        </div>
      )}
    </div>
  )
}
