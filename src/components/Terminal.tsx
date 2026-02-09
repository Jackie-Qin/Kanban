import { useEffect, useRef, useCallback, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { SerializeAddon } from '@xterm/addon-serialize'
import { electron } from '../lib/electron'
import { useTerminalSettings } from '../store/useTerminalSettings'
import { getThemeByName } from '../lib/terminalThemes'
import { eventBus } from '../lib/eventBus'

interface TerminalProps {
  terminalId: string
  projectPath: string
  isActive: boolean
  onSelect: () => void
}

export default function Terminal({
  terminalId,
  projectPath,
  isActive,
  onSelect
}: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const webglAddonRef = useRef<WebglAddon | null>(null)
  const serializeAddonRef = useRef<SerializeAddon | null>(null)
  const ptyCreatedRef = useRef(false)
  const { themeName, fontSize, fontFamily } = useTerminalSettings()

  // Fit terminal to container and scroll to bottom
  const fitTerminal = useCallback(() => {
    if (fitAddonRef.current && xtermRef.current && terminalRef.current) {
      const { offsetWidth, offsetHeight } = terminalRef.current

      if (offsetWidth >= 50 && offsetHeight >= 50) {
        try {
          fitAddonRef.current.fit()
          const { cols, rows } = xtermRef.current

          if (ptyCreatedRef.current) {
            electron.ptyResize(terminalId, cols, rows)
          }

          xtermRef.current.scrollToBottom()
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
      lineHeight: 1.0,
      letterSpacing: 0,
      theme: initTheme.theme
    })

    const fitAddon = new FitAddon()
    xterm.loadAddon(fitAddon)
    xterm.open(container)

    // WebGL renderer: renders block/box characters as filled rects (no gaps)
    try {
      const webglAddon = new WebglAddon()
      webglAddon.onContextLoss(() => {
        try { webglAddon.dispose() } catch { /* already disposed */ }
        webglAddonRef.current = null
      })
      xterm.loadAddon(webglAddon)
      webglAddonRef.current = webglAddon
    } catch {
      // Falls back to canvas renderer if WebGL unavailable
    }

    // Serialize addon for buffer persistence
    const serializeAddon = new SerializeAddon()
    xterm.loadAddon(serializeAddon)
    serializeAddonRef.current = serializeAddon

    xtermRef.current = xterm
    fitAddonRef.current = fitAddon

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
      if (e.type === 'keydown' && e.metaKey) {
        // Cmd+K: clear terminal
        if (e.key === 'k') {
          e.preventDefault()
          xterm.clear()
          xterm.scrollToBottom()
          return false
        }
        // Cmd+Left/Right: let App handle project switching
        if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.shiftKey && !e.ctrlKey && !e.altKey) {
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
        xtermRef.current?.scrollToBottom()
      }
    }, 100)

    // Handle resize — debounce to avoid flooding IPC with ptyResize calls
    // during window resize/fullscreen transitions (all terminals fire at once)
    let resizeTimer: ReturnType<typeof setTimeout> | null = null
    const resizeObserver = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(fitTerminal, 150)
    })
    resizeObserver.observe(container)

    return () => {
      clearTimeout(initTimeout)
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeObserver.disconnect()
      unsubscribeData()
      unsubscribeExit()
      dataDisposable.dispose()
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

  // Focus when active — fitTerminal handles fit + deferred scroll to bottom
  useEffect(() => {
    if (isActive && xtermRef.current) {
      xtermRef.current.focus()
      requestAnimationFrame(() => {
        fitTerminal()
      })
    }
  }, [isActive, fitTerminal])

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
          padding: '8px 0 8px 12px',
          minHeight: '100px',
          backgroundColor: bgColor
        }}
      >
        <div ref={terminalRef} className="h-full w-full" />
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
