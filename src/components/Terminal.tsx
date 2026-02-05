import { useEffect, useRef, useCallback } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
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
  const ptyCreatedRef = useRef(false)
  const { themeName, fontSize, fontFamily } = useTerminalSettings()

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
        webglAddon.dispose()
      })
      xterm.loadAddon(webglAddon)
    } catch {
      // Falls back to canvas renderer if WebGL unavailable
    }

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

  // Focus when active
  useEffect(() => {
    if (isActive && xtermRef.current) {
      xtermRef.current.focus()
      requestAnimationFrame(fitTerminal)
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
