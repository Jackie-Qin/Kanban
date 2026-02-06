import { useEffect, useRef, useCallback } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { SerializeAddon } from '@xterm/addon-serialize'
import { electron } from '../lib/electron'
import { useTerminalSettings } from '../store/useTerminalSettings'
import { getThemeByName } from '../lib/terminalThemes'

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

      if (offsetWidth > 0 && offsetHeight > 0) {
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
                window.dispatchEvent(new CustomEvent('editor:open-file', { detail: { path: imagePath, preview: true } }))
                window.dispatchEvent(new CustomEvent('panel:focus', { detail: { panelId: 'editor' } }))
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
                window.dispatchEvent(new CustomEvent('editor:open-file', { detail: { path: filePath, preview: true } }))
                window.dispatchEvent(new CustomEvent('panel:focus', { detail: { panelId: 'editor' } }))
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
                  window.dispatchEvent(new CustomEvent('editor:open-file', { detail: { path: filePath, preview: true } }))
                  window.dispatchEvent(new CustomEvent('panel:focus', { detail: { panelId: 'editor' } }))
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

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(fitTerminal)
    })
    resizeObserver.observe(container)

    return () => {
      clearTimeout(initTimeout)
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

  // Focus when active — fit then scroll to bottom so latest output is visible
  useEffect(() => {
    if (isActive && xtermRef.current) {
      xtermRef.current.focus()
      requestAnimationFrame(() => {
        fitTerminal()
        // Scroll to bottom after fit to avoid viewport resetting to top
        xtermRef.current?.scrollToBottom()
      })
    }
  }, [isActive, fitTerminal])

  const bgColor = getThemeByName(themeName).theme.background || '#14191e'

  return (
    <div
      className="h-full w-full flex flex-col min-h-0"
      onClick={onSelect}
    >
      <div
        ref={terminalRef}
        className="flex-1 min-h-0 w-full"
        style={{
          padding: '8px 12px',
          minHeight: '100px',
          backgroundColor: bgColor
        }}
      />
    </div>
  )
}
