import { useRef, useCallback, useState, useEffect } from 'react'
import {
  DockviewReact,
  DockviewReadyEvent,
  DockviewApi,
  SerializedDockview
} from 'dockview'
import { Task } from '../types'
import { useStore } from '../store/useStore'
import { useBadgeStore } from '../store/useBadgeStore'
import { gitCache, prefetchGitData, prefetchDirData } from '../lib/projectCache'
import KanbanPanel from './panels/KanbanPanel'
import TerminalDockPanel from './panels/TerminalDockPanel'
import EditorPanel from './panels/EditorPanel'
import GitPanel from './panels/GitPanel'
import DirectoryPanel from './panels/DirectoryPanel'
import PanelErrorBoundary from './PanelErrorBoundary'
import ActivityBar from './ActivityBar'
import { eventBus } from '../lib/eventBus'

interface WorkspaceLayoutProps {
  projectId: string
  projectPath: string
  onTaskClick: (task: Task, isNew?: boolean) => void
  onOpenFile?: (filePath: string) => void
}

// Wrap a panel component with an error boundary
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function withErrorBoundary(name: string, Panel: React.FC<any>): React.FC<any> {
  const Wrapped: React.FC<any> = (props) => (
    <PanelErrorBoundary panel={name}>
      <Panel {...props} />
    </PanelErrorBoundary>
  )
  Wrapped.displayName = `ErrorBoundary(${name})`
  return Wrapped
}

// Component registry for Dockview
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const components: Record<string, React.FC<any>> = {
  kanban: withErrorBoundary('Kanban', KanbanPanel),
  terminal: withErrorBoundary('Terminal', TerminalDockPanel),
  editor: withErrorBoundary('Editor', EditorPanel),
  git: withErrorBoundary('Git', GitPanel),
  directory: withErrorBoundary('Directory', DirectoryPanel)
}

// Watermark component shown in empty dockview groups
const Watermark: React.FC = () => {
  return (
    <div className="h-full w-full flex items-center justify-center bg-dark-bg">
      <p className="text-dark-muted text-sm opacity-50">Drop a panel here</p>
    </div>
  )
}

const PANEL_OPTIONS = [
  { id: 'kanban', component: 'kanban', title: 'Kanban' },
  { id: 'editor', component: 'editor', title: 'Editor' },
  { id: 'terminal', component: 'terminal', title: 'Terminal' },
  { id: 'git', component: 'git', title: 'Git' },
  { id: 'directory', component: 'directory', title: 'Directory' }
]

/** Compute where to re-add a closed panel (group with sibling or directional fallback) */
function resolvePanelPosition(panelId: string, api: DockviewApi) {
  const find = (...ids: string[]) => ids.find((id) => api.getPanel(id))

  // Sidebar panels: group with sibling, or place left of center
  if (panelId === 'directory' || panelId === 'git') {
    const sibling = panelId === 'directory' ? 'git' : 'directory'
    if (api.getPanel(sibling))
      return { position: { referencePanel: sibling, direction: 'within' as const } }
    const ref = find('kanban', 'editor')
    if (ref)
      return {
        position: { referencePanel: ref, direction: 'left' as const },
        initialWidth: 250
      }
    return {}
  }

  // Center panels: group with sibling, or place right of sidebar
  if (panelId === 'kanban' || panelId === 'editor') {
    const sibling = panelId === 'kanban' ? 'editor' : 'kanban'
    if (api.getPanel(sibling))
      return { position: { referencePanel: sibling, direction: 'within' as const } }
    const ref = find('directory', 'git')
    if (ref) return { position: { referencePanel: ref, direction: 'right' as const } }
    return {}
  }

  // Terminal: place below center panels
  if (panelId === 'terminal') {
    const ref = find('kanban', 'editor')
    if (ref)
      return {
        position: { referencePanel: ref, direction: 'below' as const },
        initialHeight: 220
      }
    return {}
  }

  return {}
}

export default function WorkspaceLayout({
  projectId,
  projectPath,
  onTaskClick,
  onOpenFile
}: WorkspaceLayoutProps) {
  const apiRef = useRef<DockviewApi | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  // Read layouts/saveLayout via refs to avoid re-rendering WorkspaceLayout on every layout save
  const saveLayoutRef = useRef(useStore.getState().saveLayout)
  const isRestoringRef = useRef(false)
  const [isEmpty, setIsEmpty] = useState(false)
  const [openPanelIds, setOpenPanelIds] = useState<string[]>([])
  const [visiblePanelIds, setVisiblePanelIds] = useState<string[]>([])

  // Debounced resize: replaces dockview's per-frame ResizeObserver with a batched one
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const ro = new ResizeObserver(() => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        if (apiRef.current) {
          apiRef.current.layout(el.offsetWidth, el.offsetHeight)
        }
      }, 16) // single frame delay — batches rapid resize events without visible lag
    })
    ro.observe(el)
    return () => {
      if (timer) clearTimeout(timer)
      ro.disconnect()
    }
  }, [])

  // Check if workspace is empty, track open panels, and compute visible panels per group
  const updatePanelState = useCallback(() => {
    if (apiRef.current) {
      const api = apiRef.current
      setIsEmpty(api.panels.length === 0)
      setOpenPanelIds(api.panels.map((p) => p.id))
      setVisiblePanelIds(
        api.groups
          .map((g) => g.activePanel?.id)
          .filter((id): id is string => !!id)
      )
    }
  }, [])

  // Reset to default layout
  const handleResetLayout = useCallback(() => {
    if (apiRef.current) {
      // Clear saved layout for this project
      saveLayoutRef.current(projectId, null)
      // Clear all existing panels
      apiRef.current.panels.forEach((panel) => panel.api.close())
      // Create default layout
      createDefaultLayoutForApi(apiRef.current)
      setIsEmpty(false)
    }
  }, [projectId])

  // Add a single panel at its natural position (sibling grouping or directional fallback)
  const handleAddPanel = useCallback(
    (panelId: string) => {
      if (!apiRef.current) return

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
        params,
        ...resolvePanelPosition(panelId, apiRef.current)
      })

      updatePanelState()
    },
    [projectId, projectPath, onTaskClick, updatePanelState]
  )

  // Toggle a panel: close if visible, activate if hidden tab, create if missing
  const handleTogglePanel = useCallback(
    (panelId: string) => {
      if (!apiRef.current) return

      const existingPanel = apiRef.current.getPanel(panelId)

      if (existingPanel) {
        // Check if panel is the visible (active) tab in its group
        const isVisible = apiRef.current.groups.some(
          (g) => g.activePanel?.id === panelId
        )
        if (isVisible) {
          existingPanel.api.close()
        } else {
          existingPanel.api.setActive()
        }
      } else {
        handleAddPanel(panelId)
      }

      // Defer state update so dockview has time to process
      setTimeout(updatePanelState, 50)
    },
    [handleAddPanel, updatePanelState]
  )

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
    return eventBus.on('panel:focus', ({ panelId }) => {
      if (apiRef.current) {
        const panel = apiRef.current.getPanel(panelId)
        if (panel) {
          panel.api.setActive()
        }
      }
    })
  }, [])

  // Listen for open-file events from SearchModal
  useEffect(() => {
    return eventBus.on('workspace:open-file', ({ filePath, line }) => {
      // Dispatch to editor panel
      if (apiRef.current) {
        const editorPanel = apiRef.current.getPanel('editor')
        if (editorPanel) {
          editorPanel.api.setActive()
          eventBus.emit('editor:open-file', { filePath, line })
        }
      }

      onOpenFile?.(filePath)
    })
  }, [onOpenFile])

  // Handle Dockview ready event
  const onReady = useCallback(
    (event: DockviewReadyEvent) => {
      apiRef.current = event.api

      // Read layouts from store snapshot (not reactive) to avoid re-render loops
      const savedLayout = useStore.getState().layouts?.[projectId]
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

      // Track active panel changes reactively (recomputes visible panels per group)
      const activeDisposable = event.api.onDidActivePanelChange(() => {
        updatePanelState()
      })

      // Save layout on structural changes only (panel add/remove/move).
      // Track panel count to distinguish structural changes from mere resize events.
      let lastPanelCount = event.api.panels.length
      let layoutSaveTimer: ReturnType<typeof setTimeout> | null = null
      let panelStateTimer: ReturnType<typeof setTimeout> | null = null
      const disposable = event.api.onDidLayoutChange(() => {
        if (!isRestoringRef.current && apiRef.current) {
          const currentPanelCount = apiRef.current.panels.length
          const isStructuralChange = currentPanelCount !== lastPanelCount
          lastPanelCount = currentPanelCount

          if (panelStateTimer) clearTimeout(panelStateTimer)
          panelStateTimer = setTimeout(updatePanelState, 150)

          // Always reset the save timer (debounce), but use a short delay for
          // structural changes and a long delay for resize/drag events
          if (layoutSaveTimer) clearTimeout(layoutSaveTimer)
          layoutSaveTimer = setTimeout(() => {
            layoutSaveTimer = null
            if (apiRef.current) {
              const layoutState = apiRef.current.toJSON()
              saveLayoutRef.current(projectId, layoutState)
            }
          }, isStructuralChange ? 300 : 2000)
        }
      })

      return () => {
        activeDisposable.dispose()
        disposable.dispose()
        // Flush pending layout save on unmount so splitter positions aren't lost
        if (layoutSaveTimer) {
          clearTimeout(layoutSaveTimer)
          if (apiRef.current) {
            const layoutState = apiRef.current.toJSON()
            saveLayoutRef.current(projectId, layoutState)
          }
        }
        if (panelStateTimer) clearTimeout(panelStateTimer)
      }
    },
    [projectId, projectPath, onTaskClick, createDefaultLayoutForApi, updatePanelState]
  )

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

  // Dismiss project badge when switching to this project
  useEffect(() => {
    useBadgeStore.getState().dismissProjectBadge(projectId)
  }, [projectId])

  // Dismiss terminal badge when terminal panel is visible for current project
  useEffect(() => {
    if (visiblePanelIds.includes('terminal')) {
      useBadgeStore.getState().dismissTerminalBadge(projectId)
    }
  }, [visiblePanelIds, projectId])

  // Prefetch git + directory data for other open projects during idle time
  const { projects, closedProjectIds } = useStore()
  useEffect(() => {
    const STALE_MS = 30_000
    const openProjects = projects.filter(
      (p) => p.id !== projectId && !closedProjectIds.includes(p.id)
    )
    if (openProjects.length === 0) return

    const idleCallback = (typeof requestIdleCallback === 'function' ? requestIdleCallback : (cb: () => void) => setTimeout(cb, 200)) as typeof requestIdleCallback
    const cancelIdle = (typeof cancelIdleCallback === 'function' ? cancelIdleCallback : clearTimeout) as typeof cancelIdleCallback

    const id = idleCallback(() => {
      for (const p of openProjects) {
        const cached = gitCache.get(p.path)
        if (!cached || Date.now() - cached.timestamp > STALE_MS) {
          prefetchGitData(p.path)
        }
        prefetchDirData(p.path)
      }
    })

    return () => cancelIdle(id)
  }, [projectId, projects, closedProjectIds])

  return (
    <div className="h-full w-full flex">
      <ActivityBar
        openPanelIds={openPanelIds}
        visiblePanelIds={visiblePanelIds}
        onTogglePanel={handleTogglePanel}
        onResetLayout={handleResetLayout}
      />
      <div ref={containerRef} className="h-full flex-1 min-w-0 relative">
        <DockviewReact
          components={components}
          watermarkComponent={Watermark}
          onReady={onReady}
          className="dockview-theme-dark"
          disableAutoResizing
        />

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
              <p className="text-dark-muted text-sm">Click an icon in the activity bar to open a panel</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
