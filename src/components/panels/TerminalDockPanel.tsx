import { useState, useRef, useCallback, useEffect, useImperativeHandle, forwardRef } from 'react'
import { IDockviewPanelProps } from 'dockview'
import Terminal from '../Terminal'
import { electron } from '../../lib/electron'

interface TerminalInfo {
  id: string
  name: string
}

interface ProjectTerminalState {
  terminals: TerminalInfo[]
  activeTerminalId: string
  isSplitView: boolean
  projectPath: string
}

interface TerminalDockPanelParams {
  projectId: string
  projectPath: string
}

export interface TerminalDockPanelRef {
  sendCommand: (command: string) => void
}

const MAX_TERMINALS = 3

const TerminalDockPanel = forwardRef<TerminalDockPanelRef, IDockviewPanelProps<TerminalDockPanelParams>>(
  ({ params }, ref) => {
    const { projectId, projectPath } = params

    // Store terminal state for ALL projects to keep them alive across switches
    const [projectStates, setProjectStates] = useState<Record<string, ProjectTerminalState>>({})
    const terminalsRef = useRef<TerminalInfo[]>([])
    const persistedStatesRef = useRef<Record<string, { terminals: { id: string; name: string }[]; activeTerminalId: string; isSplitView: boolean }> | null>(null)
    const initializedRef = useRef(false)
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Load persisted terminal states once on mount
    useEffect(() => {
      electron.getTerminalStates().then(states => {
        persistedStatesRef.current = states
        initializedRef.current = true
      }).catch(() => {
        persistedStatesRef.current = {}
        initializedRef.current = true
      })
    }, [])

    // Initialize or update state for current project
    useEffect(() => {
      setProjectStates(prev => {
        if (prev[projectId]) {
          // Project exists, update projectPath if changed
          if (prev[projectId].projectPath !== projectPath) {
            return {
              ...prev,
              [projectId]: { ...prev[projectId], projectPath }
            }
          }
          return prev
        }

        // Check persisted state first
        const persisted = persistedStatesRef.current?.[projectId]
        if (persisted) {
          return {
            ...prev,
            [projectId]: {
              terminals: persisted.terminals,
              activeTerminalId: persisted.activeTerminalId,
              isSplitView: persisted.isSplitView,
              projectPath
            }
          }
        }

        // Initialize new project with default terminal
        return {
          ...prev,
          [projectId]: {
            terminals: [{ id: `${projectId}-term-1`, name: 'Terminal 1' }],
            activeTerminalId: `${projectId}-term-1`,
            isSplitView: false,
            projectPath
          }
        }
      })
    }, [projectId, projectPath])

    // Debounced save of terminal states to disk
    useEffect(() => {
      if (!initializedRef.current) return

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      saveTimeoutRef.current = setTimeout(() => {
        const statesToSave: Record<string, { terminals: { id: string; name: string }[]; activeTerminalId: string; isSplitView: boolean }> = {}
        for (const [pid, state] of Object.entries(projectStates)) {
          statesToSave[pid] = {
            terminals: state.terminals,
            activeTerminalId: state.activeTerminalId,
            isSplitView: state.isSplitView
          }
        }
        electron.saveTerminalStates(statesToSave)
      }, 500)

      return () => {
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current)
        }
      }
    }, [projectStates])

    // Get current project's state (with fallback for initial render)
    const currentState = projectStates[projectId] || {
      terminals: [{ id: `${projectId}-term-1`, name: 'Terminal 1' }],
      activeTerminalId: `${projectId}-term-1`,
      isSplitView: false,
      projectPath
    }

    const { terminals, activeTerminalId, isSplitView } = currentState

    // Keep ref in sync with state for keyboard handler
    useEffect(() => {
      terminalsRef.current = terminals
    }, [terminals])

    // Helper to update current project's state
    const updateCurrentProjectState = useCallback(
      (updater: (state: ProjectTerminalState) => Partial<ProjectTerminalState>) => {
        setProjectStates(prev => {
          const current = prev[projectId] || currentState
          return {
            ...prev,
            [projectId]: { ...current, ...updater(current) }
          }
        })
      },
      [projectId, currentState]
    )

    // Expose sendCommand method via ref
    useImperativeHandle(ref, () => ({
      sendCommand: (command: string) => {
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
      updateCurrentProjectState(() => ({
        terminals: [...terminals, newTerminal],
        activeTerminalId: newTerminal.id
      }))
    }, [terminals, projectId, updateCurrentProjectState])

    const closeTerminal = useCallback(
      (terminalId: string) => {
        // Explicitly kill the PTY since Terminal no longer kills on unmount
        electron.ptyKill(terminalId)
        const newTerminals = terminals.filter((t) => t.id !== terminalId)
        if (newTerminals.length === 0) {
          // Re-add default terminal
          const newId = `${projectId}-term-${Date.now()}`
          updateCurrentProjectState(() => ({
            terminals: [{ id: newId, name: 'Terminal 1' }],
            activeTerminalId: newId
          }))
          return
        }
        // If closing active terminal, switch to another
        const newActiveId = terminalId === activeTerminalId ? newTerminals[0].id : activeTerminalId
        updateCurrentProjectState(() => ({
          terminals: newTerminals,
          activeTerminalId: newActiveId
        }))
      },
      [terminals, activeTerminalId, projectId, updateCurrentProjectState]
    )

    const setActiveTerminalId = useCallback(
      (id: string) => {
        updateCurrentProjectState(() => ({ activeTerminalId: id }))
      },
      [updateCurrentProjectState]
    )

    const setIsSplitView = useCallback(
      (split: boolean) => {
        updateCurrentProjectState(() => ({ isSplitView: split }))
      },
      [updateCurrentProjectState]
    )

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
    }, [setActiveTerminalId])

    return (
      <div className="h-full w-full flex flex-col bg-dark-bg">
        {/* Terminal tabs header */}
        <div className="flex items-center justify-between px-2 flex-shrink-0 h-9 bg-dark-card border-b border-dark-border">
          <div className="flex items-center gap-1 h-full">
            {terminals.map((terminal, index) => (
              <div
                key={terminal.id}
                className={`group flex items-center gap-2 px-3 h-7 text-sm cursor-pointer transition-all rounded my-auto ${
                  activeTerminalId === terminal.id
                    ? 'text-dark-text bg-dark-hover'
                    : 'text-dark-muted hover:text-dark-text'
                }`}
                onClick={() => setActiveTerminalId(terminal.id)}
              >
                <span className="font-medium">{terminal.name}</span>
                <span className="text-xs text-dark-muted">⌘{index + 1}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    closeTerminal(terminal.id)
                  }}
                  className="ml-1 p-0.5 opacity-0 group-hover:opacity-100 hover:bg-dark-border rounded transition-all"
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
                className="p-1.5 ml-1 text-dark-muted hover:text-dark-text hover:bg-dark-hover rounded transition-colors"
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
                className={`p-1.5 rounded transition-colors ${
                  isSplitView
                    ? 'text-dark-text bg-dark-hover'
                    : 'text-dark-muted hover:text-dark-text hover:bg-dark-hover'
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
          </div>
        </div>

        {/* Terminal content area - render ALL project terminals to keep them alive */}
        <div className="flex-1 flex overflow-hidden min-h-0 bg-dark-bg relative">
          {Object.entries(projectStates).map(([pid, state]) => {
            const isCurrentProject = pid === projectId
            return (
              <div
                key={pid}
                className="absolute inset-0 flex"
                style={{
                  visibility: isCurrentProject ? 'visible' : 'hidden',
                  pointerEvents: isCurrentProject ? 'auto' : 'none'
                }}
              >
                {state.isSplitView ? (
                  // Split view - show all terminals side by side
                  state.terminals.map((terminal, index) => (
                    <div
                      key={terminal.id}
                      className="flex-1 h-full min-w-0 min-h-0"
                      style={{
                        width: `${100 / state.terminals.length}%`,
                        borderLeft: index > 0 ? '1px solid rgba(255, 255, 255, 0.1)' : 'none'
                      }}
                    >
                      <Terminal
                        terminalId={terminal.id}
                        projectPath={state.projectPath}
                        isActive={isCurrentProject && state.activeTerminalId === terminal.id}
                        onSelect={() => setActiveTerminalId(terminal.id)}
                      />
                    </div>
                  ))
                ) : (
                  // Single view - show only active terminal at 100%
                  state.terminals.map((terminal) => (
                    <div
                      key={terminal.id}
                      className="h-full min-w-0 min-h-0"
                      style={{
                        width: state.activeTerminalId === terminal.id ? '100%' : '0%',
                        overflow: 'hidden'
                      }}
                    >
                      <Terminal
                        terminalId={terminal.id}
                        projectPath={state.projectPath}
                        isActive={isCurrentProject && state.activeTerminalId === terminal.id}
                        onSelect={() => setActiveTerminalId(terminal.id)}
                      />
                    </div>
                  ))
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }
)

TerminalDockPanel.displayName = 'TerminalDockPanel'

export default TerminalDockPanel
