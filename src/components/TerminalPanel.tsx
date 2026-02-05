import { useState, useRef, useCallback, useEffect, useImperativeHandle, forwardRef } from 'react'
import Terminal from './Terminal'
import { electron } from '../lib/electron'

interface TerminalInfo {
  id: string
  name: string
}

interface TerminalPanelProps {
  projectId: string
  projectPath: string
  onClose: () => void
}

export interface TerminalPanelRef {
  sendCommand: (command: string) => void
}

const MAX_TERMINALS = 3

const TerminalPanel = forwardRef<TerminalPanelRef, TerminalPanelProps>(
  ({ projectId, projectPath, onClose }, ref) => {
    const [terminals, setTerminals] = useState<TerminalInfo[]>([
      { id: `${projectId}-term-1`, name: 'Terminal 1' }
    ])
    const [activeTerminalId, setActiveTerminalId] = useState(`${projectId}-term-1`)
    const [panelHeight, setPanelHeight] = useState(300)
    const [isResizing, setIsResizing] = useState(false)
    const [isSplitView, setIsSplitView] = useState(false)
    const panelRef = useRef<HTMLDivElement>(null)
    const startYRef = useRef(0)
    const startHeightRef = useRef(0)
    const terminalsRef = useRef(terminals)

    // Keep ref in sync with state for keyboard handler
    useEffect(() => {
      terminalsRef.current = terminals
    }, [terminals])

    // Expose sendCommand method via ref
    useImperativeHandle(ref, () => ({
      sendCommand: (command: string) => {
        // Send command to the active terminal
        electron.ptyWrite(activeTerminalId, command + '\n')
      }
    }))

    const addTerminal = useCallback(() => {
      if (terminals.length >= MAX_TERMINALS) return

      const newIndex = terminals.length + 1
      const newTerminal: TerminalInfo = {
        id: `${projectId}-term-${Date.now()}`,
        name: `Terminal ${newIndex}`
      }
      setTerminals((prev) => [...prev, newTerminal])
      setActiveTerminalId(newTerminal.id)
    }, [terminals.length, projectId])

    const closeTerminal = useCallback(
      (terminalId: string) => {
        setTerminals((prev) => {
          const newTerminals = prev.filter((t) => t.id !== terminalId)
          if (newTerminals.length === 0) {
            onClose()
            return prev
          }
          // If closing active terminal, switch to another
          if (terminalId === activeTerminalId) {
            setActiveTerminalId(newTerminals[0].id)
          }
          return newTerminals
        })
      },
      [activeTerminalId, onClose]
    )

    // Handle resize drag
    const handleMouseDown = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault()
        setIsResizing(true)
        startYRef.current = e.clientY
        startHeightRef.current = panelHeight
      },
      [panelHeight]
    )

    useEffect(() => {
      if (!isResizing) return

      const handleMouseMove = (e: MouseEvent) => {
        const delta = startYRef.current - e.clientY
        const newHeight = Math.max(150, Math.min(600, startHeightRef.current + delta))
        setPanelHeight(newHeight)
      }

      const handleMouseUp = () => {
        setIsResizing(false)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)

      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }, [isResizing])

    // Keyboard shortcuts for tab switching (⌘1, ⌘2, ⌘3)
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.metaKey && !e.shiftKey && !e.altKey && !e.ctrlKey) {
          const keyNum = parseInt(e.key, 10)
          if (keyNum >= 1 && keyNum <= 3) {
            const targetIndex = keyNum - 1
            const currentTerminals = terminalsRef.current
            if (targetIndex < currentTerminals.length) {
              e.preventDefault()
              setActiveTerminalId(currentTerminals[targetIndex].id)
            }
          }
        }
      }

      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }, [])

    return (
      <div
        ref={panelRef}
        className="flex flex-col"
        style={{ height: panelHeight, background: '#1d1f21' }}
      >
        {/* Resize handle */}
        <div
          className="h-1 cursor-ns-resize transition-colors hover:bg-[#4083ff]"
          style={{ background: 'rgba(255, 255, 255, 0.1)' }}
          onMouseDown={handleMouseDown}
        />

        {/* Terminal tabs header - iTerm2 style */}
        <div
          className="flex items-center justify-between px-2 flex-shrink-0"
          style={{
            background: 'rgba(40, 42, 46, 0.95)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            height: '36px',
            boxShadow: '0 1px 0 rgba(0, 0, 0, 0.2)'
          }}
        >
          <div className="flex items-center gap-1 h-full">
            {terminals.map((terminal, index) => (
              <div
                key={terminal.id}
                className={`group flex items-center gap-2 px-3 h-[28px] text-[13px] cursor-pointer transition-all rounded-md my-auto ${
                  activeTerminalId === terminal.id
                    ? 'text-white'
                    : 'text-[#8e8e93] hover:text-[#c7c7c7]'
                }`}
                style={{
                  background:
                    activeTerminalId === terminal.id
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'transparent'
                }}
                onClick={() => setActiveTerminalId(terminal.id)}
              >
                <span className="font-medium">{terminal.name}</span>
                <span className="text-[11px] text-[#6e6e73] ml-1">⌘{index + 1}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    closeTerminal(terminal.id)
                  }}
                  className="ml-1 p-0.5 opacity-0 group-hover:opacity-100 hover:bg-[rgba(255,255,255,0.15)] rounded transition-all"
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))}

            {/* Add terminal button */}
            {terminals.length < MAX_TERMINALS && (
              <button
                onClick={addTerminal}
                className="p-1.5 ml-1 text-[#8e8e93] hover:text-white hover:bg-[rgba(255,255,255,0.1)] rounded-md transition-colors"
                title="New terminal (max 3)"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Split view toggle - only show when multiple terminals */}
            {terminals.length > 1 && (
              <button
                onClick={() => setIsSplitView(!isSplitView)}
                className={`p-1.5 rounded-md transition-colors ${
                  isSplitView
                    ? 'text-white bg-[rgba(255,255,255,0.15)]'
                    : 'text-[#8e8e93] hover:text-white hover:bg-[rgba(255,255,255,0.1)]'
                }`}
                title={isSplitView ? 'Single view' : 'Split view'}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 3v18M3 3h18v18H3V3z"
                  />
                </svg>
              </button>
            )}

            {/* Close button */}
            <button
              onClick={onClose}
              className="p-1.5 text-[#8e8e93] hover:text-white hover:bg-[rgba(255,255,255,0.1)] rounded-md transition-colors"
              title="Close terminal panel"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Terminal content area */}
        <div className="flex-1 flex overflow-hidden min-h-0" style={{ background: '#1d1f21' }}>
          {isSplitView ? (
            // Split view - show all terminals side by side
            terminals.map((terminal, index) => (
              <div
                key={terminal.id}
                className="flex-1 h-full min-w-0 min-h-0"
                style={{
                  width: `${100 / terminals.length}%`,
                  borderLeft: index > 0 ? '1px solid rgba(255, 255, 255, 0.1)' : 'none'
                }}
              >
                <Terminal
                  terminalId={terminal.id}
                  projectPath={projectPath}
                  isActive={activeTerminalId === terminal.id}
                  onSelect={() => setActiveTerminalId(terminal.id)}
                />
              </div>
            ))
          ) : (
            // Single view - show only active terminal at 100%
            terminals.map((terminal) => (
              <div
                key={terminal.id}
                className="h-full min-w-0 min-h-0"
                style={{
                  width: activeTerminalId === terminal.id ? '100%' : '0%',
                  overflow: 'hidden'
                }}
              >
                <Terminal
                  terminalId={terminal.id}
                  projectPath={projectPath}
                  isActive={activeTerminalId === terminal.id}
                  onSelect={() => setActiveTerminalId(terminal.id)}
                />
              </div>
            ))
          )}
        </div>
      </div>
    )
  }
)

TerminalPanel.displayName = 'TerminalPanel'

export default TerminalPanel
