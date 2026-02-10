import { useEffect, useState, useCallback, useRef } from 'react'
import { useStore } from './store/useStore'
import TabBar from './components/TabBar'
import WorkspaceLayout from './components/WorkspaceLayout'
import AddProjectModal from './components/AddProjectModal'
import TaskModal from './components/TaskModal'
import SettingsModal from './components/SettingsModal'
import SearchModal from './components/SearchModal'
import UpdateNotification from './components/UpdateNotification'
import TerminalNotification from './components/TerminalNotification'
import { Task } from './types'
import { electron } from './lib/electron'
import { useTerminalSettings } from './store/useTerminalSettings'
import { useHotkeySettings } from './store/useHotkeySettings'
import { useNotificationSettings } from './store/useNotificationSettings'
import { eventBus } from './lib/eventBus'
import { prefetchGitData, prefetchDirData } from './lib/projectCache'

type SearchMode = 'files' | 'text'
type SelectedTask = { task: Task; isNew?: boolean } | null

const MIN_SPLASH_MS = 3000

export default function App() {
  const { isLoading, loadData, projects, activeProjectId, closedProjectIds } = useStore()
  const [showAddProject, setShowAddProject] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [selectedTask, setSelectedTask] = useState<SelectedTask>(null)
  const [searchMode, setSearchMode] = useState<SearchMode | null>(null)
  const [preInitDone, setPreInitDone] = useState(false)
  const splashStartRef = useRef(Date.now())
  const { zoomIn, zoomOut, resetZoom, loadSettings: loadTerminalSettings } = useTerminalSettings()
  const { loadSettings: loadHotkeySettings } = useHotkeySettings()
  const { loadSettings: loadNotificationSettings } = useNotificationSettings()

  useEffect(() => {
    loadData()
    loadTerminalSettings()
    loadHotkeySettings()
    loadNotificationSettings()
  }, [loadData, loadTerminalSettings, loadHotkeySettings, loadNotificationSettings])

  // Pre-initialize all open projects after data loads
  useEffect(() => {
    if (isLoading || preInitDone) return

    const openProjects = projects.filter(p => !closedProjectIds.includes(p.id))

    const prefetchAll = Promise.allSettled(
      openProjects.flatMap(p => [prefetchGitData(p.path), prefetchDirData(p.path)])
    )

    const elapsed = Date.now() - splashStartRef.current
    const remaining = Math.max(0, MIN_SPLASH_MS - elapsed)
    const minTimer = new Promise(resolve => setTimeout(resolve, remaining))

    Promise.all([prefetchAll, minTimer]).then(() => setPreInitDone(true))
  }, [isLoading, projects, closedProjectIds, preInitDone])

  // Listen for terminal zoom IPC from menu
  useEffect(() => {
    const unsubscribe = electron.onTerminalZoom((direction) => {
      if (direction === 'in') zoomIn()
      else if (direction === 'out') zoomOut()
      else if (direction === 'reset') resetZoom()
    })
    return unsubscribe
  }, [zoomIn, zoomOut, resetZoom])

  // Listen for external file changes (auto-sync)
  useEffect(() => {
    const unsubscribe = electron.onDataFileChanged(() => {
      console.log('Data file changed externally, reloading...')
      loadData()
    })
    return unsubscribe
  }, [loadData])

  const activeProject = projects.find((p) => p.id === activeProjectId)

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const hotkeys = useHotkeySettings.getState()

      if (hotkeys.matchesEvent('file-search', e)) {
        e.preventDefault()
        setSearchMode('files')
        return
      }
      if (hotkeys.matchesEvent('text-search', e)) {
        e.preventDefault()
        setSearchMode('text')
        return
      }
      if (hotkeys.matchesEvent('new-terminal', e)) {
        e.preventDefault()
        eventBus.emit('terminal:add', {} as Record<string, never>)
        return
      }
      if (hotkeys.matchesEvent('switch-project-left', e) || hotkeys.matchesEvent('switch-project-right', e)) {
        const { projects: allProjects, activeProjectId: currentId, closedProjectIds: closedIds, setActiveProject: switchTo } = useStore.getState()
        const openProjects = allProjects.filter(p => !closedIds.includes(p.id))
        if (openProjects.length < 2) return

        const currentIndex = openProjects.findIndex(p => p.id === currentId)
        if (currentIndex === -1) return

        e.preventDefault()
        if (hotkeys.matchesEvent('switch-project-left', e)) {
          const prevIndex = (currentIndex - 1 + openProjects.length) % openProjects.length
          switchTo(openProjects[prevIndex].id)
        } else {
          const nextIndex = (currentIndex + 1) % openProjects.length
          switchTo(openProjects[nextIndex].id)
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Handle opening files from search
  const handleOpenFile = useCallback((filePath: string, line?: number) => {
    eventBus.emit('workspace:open-file', { filePath, line })
  }, [])

  if (isLoading || !preInitDone) {
    return (
      <div className="h-screen flex items-center justify-center bg-dark-bg">
        <svg
          className="animate-breathe"
          width="80"
          height="80"
          viewBox="0 0 1024 1024"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="50" y="50" width="924" height="924" rx="180" fill="#0d1117" />
          <rect x="150" y="180" width="220" height="664" rx="20" fill="#161b22" />
          <rect x="150" y="180" width="220" height="14" rx="7" fill="#6b7280" />
          <rect x="170" y="230" width="180" height="100" rx="12" fill="#0d1117" />
          <rect x="170" y="350" width="180" height="100" rx="12" fill="#0d1117" />
          <rect x="170" y="470" width="180" height="100" rx="12" fill="#0d1117" />
          <rect x="400" y="180" width="220" height="664" rx="20" fill="#161b22" />
          <rect x="400" y="180" width="220" height="14" rx="7" fill="#a855f7" />
          <rect x="420" y="230" width="180" height="100" rx="12" fill="#0d1117" />
          <rect x="420" y="350" width="180" height="100" rx="12" fill="#0d1117" />
          <rect x="650" y="180" width="220" height="664" rx="20" fill="#161b22" />
          <rect x="650" y="180" width="220" height="14" rx="7" fill="#22c55e" />
          <rect x="670" y="230" width="180" height="100" rx="12" fill="#0d1117" />
        </svg>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-dark-bg overflow-hidden">
      <TabBar
        onAddProject={() => setShowAddProject(true)}
        onOpenSettings={() => setShowSettings(true)}
        onOpenSearch={() => setSearchMode('files')}
      />

      {activeProject ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          <WorkspaceLayout
            projectId={activeProject.id}
            projectPath={activeProject.path}
            onTaskClick={(task, isNew) => setSelectedTask({ task, isNew })}
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-dark-muted mb-4">No projects yet</p>
            <button
              onClick={() => setShowAddProject(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors"
            >
              Create your first project
            </button>
          </div>
        </div>
      )}

      {showAddProject && (
        <AddProjectModal onClose={() => setShowAddProject(false)} />
      )}

      {selectedTask && (
        <TaskModal
          task={selectedTask.task}
          isNew={selectedTask.isNew}
          onClose={() => setSelectedTask(null)}
        />
      )}

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}

      {searchMode && activeProject && (
        <SearchModal
          isOpen={true}
          mode={searchMode}
          projectPath={activeProject.path}
          onClose={() => setSearchMode(null)}
          onOpenFile={handleOpenFile}
        />
      )}

      <UpdateNotification />
      <TerminalNotification />
    </div>
  )
}
