import { useState, useRef, useCallback, useEffect, useImperativeHandle, forwardRef } from 'react'
import { IDockviewPanelProps } from 'dockview'
import Terminal from '../Terminal'
import { electron } from '../../lib/electron'
import { eventBus } from '../../lib/eventBus'
import { useStore } from '../../store/useStore'
import { useHotkeySettings } from '../../store/useHotkeySettings'
import { formatBinding } from '../../lib/hotkeys'

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
    const [initialized, setInitialized] = useState(false)
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const prewarmTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])

    // Load persisted terminal states once on mount
    useEffect(() => {
      electron.getTerminalStates().then(states => {
        persistedStatesRef.current = states
        setInitialized(true)
      }).catch(() => {
        persistedStatesRef.current = {}
        setInitialized(true)
      })
      return () => {
        prewarmTimersRef.current.forEach(clearTimeout)
      }
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

    // Prewarm: stagger-init terminals for other projects during idle time
    // so tab switches don't freeze. PTYs are already prewarmed on the Electron side.
    useEffect(() => {
      if (!initialized || !persistedStatesRef.current) return
      const persisted = persistedStatesRef.current
      const projects = useStore.getState().projects
      const closedIds = new Set(useStore.getState().closedProjectIds)
      const pathMap = new Map(projects.map(p => [p.id, p.path]))

      let delay = 1500 // start after 1.5s to let the active terminal settle
      prewarmTimersRef.current.forEach(clearTimeout)
      prewarmTimersRef.current = []

      for (const [pid, state] of Object.entries(persisted)) {
        if (pid === projectId) continue // active project already initialized
        if (closedIds.has(pid)) continue // skip closed projects
        const path = pathMap.get(pid)
        if (!path) continue

        const timer = setTimeout(() => {
          setProjectStates(prev => {
            if (prev[pid]) return prev // already initialized
            return {
              ...prev,
              [pid]: {
                terminals: state.terminals,
                activeTerminalId: state.activeTerminalId,
                isSplitView: state.isSplitView,
                projectPath: path
              }
            }
          })
        }, delay)
        prewarmTimersRef.current.push(timer)
        delay += 800 // stagger each project by 800ms
      }
    }, [initialized, projectId]) // runs after persisted states load + on project switch

    // Debounced save of terminal states to disk
    useEffect(() => {
      if (!initialized) return

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

      // Find the lowest unused terminal number to avoid duplicates
      const usedNumbers = new Set(
        terminals.map(t => {
          const match = t.name.match(/^Terminal (\d+)$/)
          return match ? parseInt(match[1], 10) : 0
        })
      )
      let nextNumber = 1
      while (usedNumbers.has(nextNumber)) nextNumber++

      const newTerminal: TerminalInfo = {
        id: `${projectId}-term-${Date.now()}`,
        name: `Terminal ${nextNumber}`
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
        // Renumber remaining terminals sequentially
        const renumbered = newTerminals.map((t, i) => ({ ...t, name: `Terminal ${i + 1}` }))
        // If closing active terminal, switch to another
        const newActiveId = terminalId === activeTerminalId ? renumbered[0].id : activeTerminalId
        updateCurrentProjectState(() => ({
          terminals: renumbered,
          activeTerminalId: newActiveId
        }))
      },
      [terminals, activeTerminalId, projectId, updateCurrentProjectState]
    )

    const setActiveTerminalId = useCallback(
      (id: string) => {
        // Skip state update if already active — avoids unnecessary re-renders
        // that can cascade into fitTerminal calls and viewport scroll glitches
        setProjectStates(prev => {
          const current = prev[projectId]
          if (current && current.activeTerminalId === id) return prev
          const base = current || currentState
          return { ...prev, [projectId]: { ...base, activeTerminalId: id } }
        })
      },
      [projectId, currentState]
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
        const hotkeys = useHotkeySettings.getState()
        for (let i = 0; i < 3; i++) {
          if (hotkeys.matchesEvent(`terminal-${i + 1}`, e)) {
            const currentTerminals = terminalsRef.current
            if (i < currentTerminals.length) {
              e.preventDefault()
              setActiveTerminalId(currentTerminals[i].id)
            }
            return
          }
        }
      }

      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }, [setActiveTerminalId])

    // Listen for terminal:add event (⌘T from App.tsx)
    useEffect(() => {
      return eventBus.on('terminal:add', () => {
        addTerminal()
      })
    }, [addTerminal])

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
                <span className="text-xs text-dark-muted">{formatBinding(useHotkeySettings.getState().getBinding(`terminal-${index + 1}`))}</span>
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
                title="New terminal ⌘T (max 3)"
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
                        terminalName={terminal.name}
                        isActive={isCurrentProject && state.activeTerminalId === terminal.id}
                        isVisible={isCurrentProject}
                        onSelect={() => setActiveTerminalId(terminal.id)}
                      />
                    </div>
                  ))
                ) : (
                  // Single view - stack terminals, toggle visibility (no width changes)
                  state.terminals.map((terminal) => {
                    const isActiveTerminal = state.activeTerminalId === terminal.id
                    return (
                      <div
                        key={terminal.id}
                        className="absolute inset-0"
                        style={{
                          visibility: isActiveTerminal ? undefined : 'hidden',
                          pointerEvents: isActiveTerminal ? 'auto' : 'none'
                        }}
                      >
                        <Terminal
                          terminalId={terminal.id}
                          projectPath={state.projectPath}
                          terminalName={terminal.name}
                          isActive={isCurrentProject && isActiveTerminal}
                          isVisible={isCurrentProject && isActiveTerminal}
                          onSelect={() => setActiveTerminalId(terminal.id)}
                        />
                      </div>
                    )
                  })
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
