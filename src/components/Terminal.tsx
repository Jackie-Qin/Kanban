import { useEffect, useRef, useCallback } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { electron } from '../lib/electron'

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
  const ptyCreatedRef = useRef(false)

  // Fit terminal to container
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
        } catch (e) {
          console.error(`[Terminal] Failed to fit:`, e)
        }
      }
    }
  }, [terminalId])

  useEffect(() => {
    const container = terminalRef.current
    if (!container) return

    // Clear container in case of remount
    container.innerHTML = ''


    // Initialize xterm with dark gray theme
    const xterm = new XTerm({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "SF Mono", "Fira Code", Consolas, monospace',
      fontWeight: '400',
      fontWeightBold: '600',
      lineHeight: 1.2,
      letterSpacing: 0,
      allowTransparency: true,
      theme: {
        // Dark gray theme
        background: '#1a1a1a',
        foreground: '#e0e0e0',
        cursor: '#e0e0e0',
        cursorAccent: '#1a1a1a',
        selectionBackground: '#404040',
        selectionForeground: '#ffffff',
        // ANSI colors
        black: '#1a1a1a',
        red: '#f44747',
        green: '#4ec9b0',
        yellow: '#dcdcaa',
        blue: '#569cd6',
        magenta: '#c586c0',
        cyan: '#4ec9b0',
        white: '#e0e0e0',
        brightBlack: '#666666',
        brightRed: '#f44747',
        brightGreen: '#4ec9b0',
        brightYellow: '#dcdcaa',
        brightBlue: '#569cd6',
        brightMagenta: '#c586c0',
        brightCyan: '#4ec9b0',
        brightWhite: '#ffffff'
      }
    })

    const fitAddon = new FitAddon()
    xterm.loadAddon(fitAddon)
    xterm.open(container)

    xtermRef.current = xterm
    fitAddonRef.current = fitAddon

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

    // Fit and create PTY after render
    const initTimeout = setTimeout(async () => {
      if (fitAddonRef.current && xtermRef.current) {
        fitAddonRef.current.fit()

        // Create PTY
        if (!ptyCreatedRef.current) {
          const success = await electron.ptyCreate(terminalId, projectPath)

          if (success) {
            ptyCreatedRef.current = true
            electron.ptyResize(terminalId, xtermRef.current.cols, xtermRef.current.rows)
          }
        }
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

      // Only kill PTY if it was created
      if (ptyCreatedRef.current) {
        electron.ptyKill(terminalId)
        ptyCreatedRef.current = false
      }

      xterm.dispose()
      xtermRef.current = null
      fitAddonRef.current = null
    }
  }, [terminalId, projectPath, fitTerminal])

  // Focus when active
  useEffect(() => {
    if (isActive && xtermRef.current) {
      xtermRef.current.focus()
      requestAnimationFrame(fitTerminal)
    }
  }, [isActive, fitTerminal])

  return (
    <div
      className="h-full w-full flex flex-col min-h-0"
      onClick={onSelect}
    >
      <div
        ref={terminalRef}
        className="flex-1 min-h-0 w-full bg-dark-bg"
        style={{
          padding: '8px 12px',
          minHeight: '100px'
        }}
      />
    </div>
  )
}
