import { useEffect, useState } from 'react'
import { useStore } from './store/useStore'
import TabBar from './components/TabBar'
import WorkspaceLayout from './components/WorkspaceLayout'
import AddProjectModal from './components/AddProjectModal'
import TaskModal from './components/TaskModal'
import SettingsModal from './components/SettingsModal'
import UpdateNotification from './components/UpdateNotification'
import { Task } from './types'

export default function App() {
  const { isLoading, loadData, projects, activeProjectId } = useStore()
  const [showAddProject, setShowAddProject] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  useEffect(() => {
    loadData()
  }, [loadData])

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-dark-bg">
        <div className="text-dark-muted">Loading...</div>
      </div>
    )
  }

  const activeProject = projects.find((p) => p.id === activeProjectId)

  return (
    <div className="h-screen flex flex-col bg-dark-bg overflow-hidden">
      {/* Draggable title bar area */}
      <div className="h-8 bg-dark-bg app-drag-region" />

      <TabBar
        onAddProject={() => setShowAddProject(true)}
        onOpenSettings={() => setShowSettings(true)}
      />

      {activeProject ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          <WorkspaceLayout
            projectId={activeProject.id}
            projectPath={activeProject.path}
            onTaskClick={setSelectedTask}
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
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}

      <UpdateNotification />
    </div>
  )
}
