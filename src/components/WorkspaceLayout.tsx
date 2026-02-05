import { useRef, useCallback, useState, useEffect } from 'react'
import {
  DockviewReact,
  DockviewReadyEvent,
  DockviewApi,
  SerializedDockview
} from 'dockview'
import { Task } from '../types'
import { useStore } from '../store/useStore'
import KanbanPanel from './panels/KanbanPanel'
import TerminalDockPanel from './panels/TerminalDockPanel'
import EditorPanel from './panels/EditorPanel'
import GitPanel from './panels/GitPanel'
import DirectoryPanel from './panels/DirectoryPanel'

interface WorkspaceLayoutProps {
  projectId: string
  projectPath: string
  onTaskClick: (task: Task, isNew?: boolean) => void
  onOpenFile?: (filePath: string) => void
}

// Component registry for Dockview
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const components: Record<string, React.FC<any>> = {
  kanban: KanbanPanel,
  terminal: TerminalDockPanel,
  editor: EditorPanel,
  git: GitPanel,
  directory: DirectoryPanel
}

// Watermark component shown in empty dockview groups
const Watermark: React.FC = () => {
  return (
    <div className="h-full w-full flex items-center justify-center bg-dark-bg">
      <p className="text-dark-muted text-sm opacity-50">Drop a panel here</p>
    </div>
  )
}

// Panel icon SVGs
const PANEL_ICONS: Record<string, React.ReactNode> = {
  kanban: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="5" height="18" rx="1" />
      <rect x="10" y="3" width="5" height="12" rx="1" />
      <rect x="17" y="3" width="5" height="15" rx="1" />
    </svg>
  ),
  editor: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  ),
  terminal: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  ),
  git: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  ),
  directory: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

const PANEL_OPTIONS = [
  { id: 'kanban', component: 'kanban', title: 'Kanban' },
  { id: 'editor', component: 'editor', title: 'Editor' },
  { id: 'terminal', component: 'terminal', title: 'Terminal' },
  { id: 'git', component: 'git', title: 'Git' },
  { id: 'directory', component: 'directory', title: 'Directory' }
]

export default function WorkspaceLayout({
  projectId,
  projectPath,
  onTaskClick,
  onOpenFile
}: WorkspaceLayoutProps) {
  const apiRef = useRef<DockviewApi | null>(null)
  const { layouts, saveLayout } = useStore()
  const isRestoringRef = useRef(false)
  const [isEmpty, setIsEmpty] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [openPanelIds, setOpenPanelIds] = useState<string[]>([])

  // Check if workspace is empty and track open panels
  const updatePanelState = useCallback(() => {
    if (apiRef.current) {
      const panels = apiRef.current.panels
      setIsEmpty(panels.length === 0)
      setOpenPanelIds(panels.map((p) => p.id))
    }
  }, [])

  // Reset to default layout
  const handleResetLayout = useCallback(() => {
    if (apiRef.current) {
      // Clear saved layout for this project
      saveLayout(projectId, null)
      // Clear all existing panels
      apiRef.current.panels.forEach((panel) => panel.api.close())
      // Create default layout
      createDefaultLayoutForApi(apiRef.current)
      setIsEmpty(false)
    }
  }, [projectId, saveLayout])

  // Add a single panel
  const handleAddPanel = useCallback(
    (panelId: string) => {
      if (!apiRef.current) return
      setContextMenu(null)

      const params =
        panelId === 'kanban'
          ? { projectId, projectPath, onTaskClick }
          : { projectId, projectPath }

      const panel = PANEL_OPTIONS.find((p) => p.id === panelId)
      if (!panel) return

      apiRef.current.addPanel({
        id: panel.id,
        component: panel.component,
        title: panel.title,
        params
      })

      updatePanelState()
    },
    [projectId, projectPath, onTaskClick, updatePanelState]
  )

  // Handle right-click context menu
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }, [])

  // Create default layout (extracted to be callable separately)
  const createDefaultLayoutForApi = useCallback(
    (api: DockviewApi) => {
      // Add directory panel on the left (narrow sidebar)
      api.addPanel({
        id: 'directory',
        component: 'directory',
        title: 'Directory',
        params: { projectId, projectPath },
        initialWidth: 250
      })

      // Add git panel (grouped with directory as tabs)
      api.addPanel({
        id: 'git',
        component: 'git',
        title: 'Git',
        params: { projectId, projectPath },
        position: { referencePanel: 'directory', direction: 'within' }
      })

      // Add kanban panel in the center (takes remaining width)
      api.addPanel({
        id: 'kanban',
        component: 'kanban',
        title: 'Kanban',
        params: { projectId, projectPath, onTaskClick },
        position: { referencePanel: 'directory', direction: 'right' }
      })

      // Add editor panel (grouped with kanban as tabs)
      api.addPanel({
        id: 'editor',
        component: 'editor',
        title: 'Editor',
        params: { projectId, projectPath },
        position: { referencePanel: 'kanban', direction: 'within' }
      })

      // Add terminal panel below kanban/editor area
      api.addPanel({
        id: 'terminal',
        component: 'terminal',
        title: 'Terminal',
        params: { projectId, projectPath },
        position: { referencePanel: 'kanban', direction: 'below' },
        initialHeight: 220
      })

      // Activate kanban panel by default after a short delay
      setTimeout(() => {
        const kanbanPanel = api.getPanel('kanban')
        if (kanbanPanel) {
          kanbanPanel.api.setActive()
        }
      }, 100)
    },
    [projectId, projectPath, onTaskClick]
  )

  // Listen for panel focus events
  useEffect(() => {
    const handlePanelFocus = (e: Event) => {
      const customEvent = e as CustomEvent<{ panelId: string }>
      const { panelId } = customEvent.detail
      if (apiRef.current) {
        const panel = apiRef.current.getPanel(panelId)
        if (panel) {
          panel.api.setActive()
        }
      }
    }

    window.addEventListener('panel:focus', handlePanelFocus)
    return () => window.removeEventListener('panel:focus', handlePanelFocus)
  }, [])

  // Listen for open-file events from SearchModal
  useEffect(() => {
    const handleOpenFile = (e: Event) => {
      const customEvent = e as CustomEvent<{ filePath: string }>
      const { filePath } = customEvent.detail

      // Dispatch to editor panel
      if (apiRef.current) {
        const editorPanel = apiRef.current.getPanel('editor')
        if (editorPanel) {
          editorPanel.api.setActive()
          // Use the onOpenFile callback or dispatch event to editor
          window.dispatchEvent(new CustomEvent('editor:open-file', { detail: { filePath } }))
        }
      }

      onOpenFile?.(filePath)
    }

    window.addEventListener('workspace:open-file', handleOpenFile)
    return () => window.removeEventListener('workspace:open-file', handleOpenFile)
  }, [onOpenFile])

  // Handle Dockview ready event
  const onReady = useCallback(
    (event: DockviewReadyEvent) => {
      apiRef.current = event.api

      // Try to restore saved layout
      const savedLayout = layouts?.[projectId]
      if (savedLayout) {
        try {
          isRestoringRef.current = true
          event.api.fromJSON(savedLayout as SerializedDockview)
          isRestoringRef.current = false

          // Update panel params after restore
          const kanbanPanel = event.api.getPanel('kanban')
          const terminalPanel = event.api.getPanel('terminal')
          const editorPanel = event.api.getPanel('editor')
          const gitPanel = event.api.getPanel('git')
          const directoryPanel = event.api.getPanel('directory')

          // Update params for each panel
          if (kanbanPanel) {
            kanbanPanel.update({ params: { projectId, projectPath, onTaskClick } })
          }
          if (terminalPanel) {
            terminalPanel.update({ params: { projectId, projectPath } })
          }
          if (editorPanel) {
            editorPanel.update({ params: { projectId, projectPath } })
          }
          if (gitPanel) {
            gitPanel.update({ params: { projectId, projectPath } })
          }
          if (directoryPanel) {
            directoryPanel.update({ params: { projectId, projectPath } })
          }
        } catch (e) {
          console.warn('Failed to restore layout, creating default:', e)
          createDefaultLayoutForApi(event.api)
        }
      } else {
        createDefaultLayoutForApi(event.api)
      }

      // Check initial state
      updatePanelState()

      // Save layout on changes and update panel state
      const disposable = event.api.onDidLayoutChange(() => {
        if (!isRestoringRef.current && apiRef.current) {
          const layoutState = apiRef.current.toJSON()
          saveLayout(projectId, layoutState)
          updatePanelState()
        }
      })

      return () => {
        disposable.dispose()
      }
    },
    [projectId, projectPath, onTaskClick, layouts, saveLayout, createDefaultLayoutForApi, updatePanelState]
  )

  // Get panels that aren't currently open
  const closedPanels = PANEL_OPTIONS.filter((p) => !openPanelIds.includes(p.id))

  // Handle project changes - update all panels including terminal
  useEffect(() => {
    if (!apiRef.current) return

    // Update params for each panel
    const kanbanPanel = apiRef.current.getPanel('kanban')
    const editorPanel = apiRef.current.getPanel('editor')
    const gitPanel = apiRef.current.getPanel('git')
    const directoryPanel = apiRef.current.getPanel('directory')
    const terminalPanel = apiRef.current.getPanel('terminal')

    if (kanbanPanel) {
      kanbanPanel.update({ params: { projectId, projectPath, onTaskClick } })
    }
    if (editorPanel) {
      editorPanel.update({ params: { projectId, projectPath } })
    }
    if (gitPanel) {
      gitPanel.update({ params: { projectId, projectPath } })
    }
    if (directoryPanel) {
      directoryPanel.update({ params: { projectId, projectPath } })
    }
    if (terminalPanel) {
      terminalPanel.update({ params: { projectId, projectPath } })
    }
  }, [projectId, projectPath, onTaskClick])

  return (
    <div className="h-full w-full relative" onContextMenu={handleContextMenu}>
      <DockviewReact
        components={components}
        watermarkComponent={Watermark}
        onReady={onReady}
        className="dockview-theme-dark"
      />

      {/* Side toolbar for closed panels */}
      {closedPanels.length > 0 && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1 p-1.5 bg-dark-card/90 backdrop-blur-sm border border-dark-border rounded-lg z-10 shadow-lg">
          {closedPanels.map((panel) => (
            <button
              key={panel.id}
              onClick={() => handleAddPanel(panel.id)}
              className="p-2 hover:bg-dark-hover rounded-md text-dark-muted hover:text-dark-text transition-colors"
              title={panel.title}
            >
              {PANEL_ICONS[panel.id]}
            </button>
          ))}
          {closedPanels.length >= 3 && (
            <>
              <div className="border-t border-dark-border my-0.5" />
              <button
                onClick={handleResetLayout}
                className="p-2 hover:bg-dark-hover rounded-md text-blue-400 hover:text-blue-300 transition-colors"
                title="Reset Layout"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 1 9 9" />
                  <polyline points="3 7 3 12 8 12" />
                </svg>
              </button>
            </>
          )}
        </div>
      )}

      {/* Empty state overlay when all panels are closed */}
      {isEmpty && (
        <div className="absolute inset-0 flex items-center justify-center bg-dark-bg pointer-events-none">
          <div className="text-center">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-dark-muted opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
              />
            </svg>
            <p className="text-dark-muted mb-2">All panels closed</p>
            <p className="text-dark-muted text-sm">Use the buttons on the right to reopen panels</p>
          </div>
        </div>
      )}

      {/* Context menu for adding panels */}
      {contextMenu && closedPanels.length > 0 && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed z-50 bg-dark-card border border-dark-border rounded-lg shadow-lg py-1 min-w-[160px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <div className="px-3 py-1.5 text-xs text-dark-muted border-b border-dark-border">
              Open Panel
            </div>
            {closedPanels.map((panel) => (
              <button
                key={panel.id}
                onClick={() => handleAddPanel(panel.id)}
                className="w-full px-4 py-2 text-left text-sm hover:bg-dark-hover"
              >
                {panel.title}
              </button>
            ))}
            {closedPanels.length === PANEL_OPTIONS.length && (
              <>
                <div className="border-t border-dark-border my-1" />
                <button
                  onClick={() => {
                    setContextMenu(null)
                    handleResetLayout()
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-dark-hover text-blue-400"
                >
                  Reset All
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
