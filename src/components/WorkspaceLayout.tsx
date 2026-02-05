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
  onTaskClick: (task: Task) => void
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
  onTaskClick
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
      // Add directory panel on the left
      api.addPanel({
        id: 'directory',
        component: 'directory',
        title: 'Directory',
        params: { projectId, projectPath }
      })

      // Add git panel (grouped with directory)
      api.addPanel({
        id: 'git',
        component: 'git',
        title: 'Git',
        params: { projectId, projectPath },
        position: { referencePanel: 'directory', direction: 'within' }
      })

      // Add kanban panel in the center
      api.addPanel({
        id: 'kanban',
        component: 'kanban',
        title: 'Kanban',
        params: { projectId, projectPath, onTaskClick },
        position: { referencePanel: 'directory', direction: 'right' }
      })

      // Add editor panel (grouped with kanban)
      api.addPanel({
        id: 'editor',
        component: 'editor',
        title: 'Editor',
        params: { projectId, projectPath },
        position: { referencePanel: 'kanban', direction: 'within' }
      })

      // Add terminal panel at the bottom
      api.addPanel({
        id: 'terminal',
        component: 'terminal',
        title: 'Terminal',
        params: { projectId, projectPath },
        position: { referencePanel: 'kanban', direction: 'below' }
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

  // Handle project changes - update non-terminal panels
  useEffect(() => {
    if (!apiRef.current) return

    // Update params for each panel except terminal (to preserve terminal sessions)
    const kanbanPanel = apiRef.current.getPanel('kanban')
    const editorPanel = apiRef.current.getPanel('editor')
    const gitPanel = apiRef.current.getPanel('git')
    const directoryPanel = apiRef.current.getPanel('directory')

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
    // Note: Terminal panel is NOT updated to preserve terminal sessions across project switches
  }, [projectId, projectPath, onTaskClick])

  return (
    <div className="h-full w-full relative" onContextMenu={handleContextMenu}>
      <DockviewReact
        components={components}
        onReady={onReady}
        className="dockview-theme-dark"
      />

      {/* Empty state overlay */}
      {isEmpty && (
        <div className="absolute inset-0 flex items-center justify-center bg-dark-bg">
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
            <p className="text-dark-muted mb-4">All panels closed</p>
            <p className="text-dark-muted text-sm mb-4">Right-click to open panels</p>
            <button
              onClick={handleResetLayout}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Reset Layout
            </button>
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
