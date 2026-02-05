import { useEffect, useState, useCallback } from 'react'
import { useStore } from './store/useStore'
import TabBar from './components/TabBar'
import WorkspaceLayout from './components/WorkspaceLayout'
import AddProjectModal from './components/AddProjectModal'
import TaskModal from './components/TaskModal'
import SettingsModal from './components/SettingsModal'
import SearchModal from './components/SearchModal'
import UpdateNotification from './components/UpdateNotification'
import { Task } from './types'
import { electron } from './lib/electron'
import { useTerminalSettings } from './store/useTerminalSettings'

type SearchMode = 'files' | 'text'
type SelectedTask = { task: Task; isNew?: boolean } | null

export default function App() {
  const { isLoading, loadData, projects, activeProjectId } = useStore()
  const [showAddProject, setShowAddProject] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [selectedTask, setSelectedTask] = useState<SelectedTask>(null)
  const [searchMode, setSearchMode] = useState<SearchMode | null>(null)
  const { zoomIn, zoomOut, resetZoom, loadSettings: loadTerminalSettings } = useTerminalSettings()

  useEffect(() => {
    loadData()
    loadTerminalSettings()
  }, [loadData, loadTerminalSettings])

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

  // Handle keyboard shortcuts for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+P: File search
      if (e.metaKey && e.key === 'p' && !e.shiftKey) {
        e.preventDefault()
        setSearchMode('files')
      }
      // Cmd+Shift+F: Text search
      if (e.metaKey && e.shiftKey && e.key === 'f') {
        e.preventDefault()
        setSearchMode('text')
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Handle opening files from search
  const handleOpenFile = useCallback((filePath: string, line?: number) => {
    // Dispatch event to workspace/editor
    window.dispatchEvent(new CustomEvent('workspace:open-file', {
      detail: { filePath, line }
    }))
  }, [])

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-dark-bg">
        <div className="text-dark-muted">Loading...</div>
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
    </div>
  )
}
