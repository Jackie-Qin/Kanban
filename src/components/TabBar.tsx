import { useStore } from '../store/useStore'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState } from 'react'
import { Project } from '../types'

interface TabBarProps {
  onAddProject: () => void
  onOpenSettings: () => void
  onOpenSearch: () => void
}

function SortableTab({
  project,
  isActive,
  onClick,
  onContextMenu
}: {
  project: Project
  isActive: boolean
  onClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: project.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`px-4 py-1.5 text-sm font-medium cursor-pointer rounded-md transition-colors no-drag ${
        isActive
          ? 'bg-white/15 text-white'
          : 'text-dark-muted hover:text-dark-text hover:bg-white/5'
      }`}
    >
      {project.name}
    </div>
  )
}

export default function TabBar({ onAddProject, onOpenSettings, onOpenSearch }: TabBarProps) {
  const { projects, activeProjectId, closedProjectIds, setActiveProject, reorderProjects, deleteProject, closeProject, reopenProject, updateProject } =
    useStore()
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    projectId: string
  } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [showClosedMenu, setShowClosedMenu] = useState(false)

  // Filter out closed projects for display
  const openProjects = projects.filter((p) => !closedProjectIds.includes(p.id))
  const closedProjects = projects.filter((p) => closedProjectIds.includes(p.id))

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = openProjects.findIndex((p) => p.id === active.id)
      const newIndex = openProjects.findIndex((p) => p.id === over.id)
      const newOrder = arrayMove(
        openProjects.map((p) => p.id),
        oldIndex,
        newIndex
      )
      // Include closed projects at the end to maintain their order
      const fullOrder = [...newOrder, ...closedProjects.map((p) => p.id)]
      reorderProjects(fullOrder)
    }
  }

  const handleClose = (projectId: string) => {
    closeProject(projectId)
    setContextMenu(null)
  }

  const handleReopen = (projectId: string) => {
    reopenProject(projectId)
    setShowClosedMenu(false)
  }

  const handleContextMenu = (e: React.MouseEvent, projectId: string) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, projectId })
  }

  const handleRename = (projectId: string) => {
    const project = projects.find((p) => p.id === projectId)
    if (project) {
      setEditingId(projectId)
      setEditName(project.name)
    }
    setContextMenu(null)
  }

  const handleDelete = (projectId: string) => {
    if (confirm('Delete this project and all its tasks?')) {
      deleteProject(projectId)
    }
    setContextMenu(null)
  }

  const handleSaveRename = () => {
    if (editingId && editName.trim()) {
      updateProject(editingId, { name: editName.trim() })
    }
    setEditingId(null)
    setEditName('')
  }

  return (
    <>
      {/* Combined title bar + tab bar - draggable region with traffic light padding */}
      <div className="relative flex items-center h-10 px-4 border-b border-dark-border bg-dark-bg app-drag-region">
        {/* Left padding for macOS traffic lights (window controls) */}
        <div className="w-16 flex-shrink-0" />

        {/* Center: Project tabs - absolutely positioned for true centering */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-1 pointer-events-auto">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={openProjects.map((p) => p.id)}
                strategy={horizontalListSortingStrategy}
              >
                <div className="flex items-center gap-1">
                  {openProjects.map((project) => (
                    editingId === project.id ? (
                      <input
                        key={project.id}
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={handleSaveRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename()
                          if (e.key === 'Escape') {
                            setEditingId(null)
                            setEditName('')
                          }
                        }}
                        autoFocus
                        className="px-3 py-1.5 text-sm bg-dark-card border border-blue-500 rounded outline-none no-drag"
                      />
                    ) : (
                      <SortableTab
                        key={project.id}
                        project={project}
                        isActive={project.id === activeProjectId}
                        onClick={() => setActiveProject(project.id)}
                        onContextMenu={(e) => handleContextMenu(e, project.id)}
                      />
                    )
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <button
              onClick={onAddProject}
              className="ml-1 p-1.5 text-dark-muted hover:text-dark-text hover:bg-dark-hover rounded transition-colors no-drag"
              title="Add project"
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

            {/* Closed tabs dropdown */}
            {closedProjects.length > 0 && (
              <div className="relative ml-1">
                <button
                  onClick={() => setShowClosedMenu(!showClosedMenu)}
                  className="p-1.5 text-dark-muted hover:text-dark-text hover:bg-dark-hover rounded transition-colors no-drag"
                  title={`${closedProjects.length} closed tab${closedProjects.length > 1 ? 's' : ''}`}
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
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1" />

        {/* Search button */}
        <button
          onClick={onOpenSearch}
          className="p-1.5 text-dark-muted hover:text-dark-text hover:bg-dark-hover rounded transition-colors no-drag mr-1"
          title="Search (Cmd+P)"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </button>

        <button
          onClick={onOpenSettings}
          className="p-1.5 text-dark-muted hover:text-dark-text hover:bg-dark-hover rounded transition-colors no-drag"
          title="Settings"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed z-50 bg-dark-card border border-dark-border rounded-lg shadow-lg py-1 animate-fadeIn"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => handleRename(contextMenu.projectId)}
              className="w-full px-4 py-2 text-left text-sm hover:bg-dark-hover"
            >
              Rename
            </button>
            <button
              onClick={() => handleClose(contextMenu.projectId)}
              className="w-full px-4 py-2 text-left text-sm hover:bg-dark-hover"
            >
              Close
            </button>
            <button
              onClick={() => handleDelete(contextMenu.projectId)}
              className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-dark-hover"
            >
              Delete
            </button>
          </div>
        </>
      )}

      {/* Closed tabs menu */}
      {showClosedMenu && closedProjects.length > 0 && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowClosedMenu(false)}
          />
          <div
            className="fixed z-50 bg-dark-card border border-dark-border rounded-lg shadow-lg py-1 animate-fadeIn"
            style={{ left: 200, top: 40 }}
          >
            <div className="px-3 py-1.5 text-xs text-dark-muted border-b border-dark-border">
              Closed Tabs
            </div>
            {closedProjects.map((project) => (
              <button
                key={project.id}
                onClick={() => handleReopen(project.id)}
                className="w-full px-4 py-2 text-left text-sm hover:bg-dark-hover flex items-center justify-between gap-4"
              >
                <span>{project.name}</span>
                <span className="text-xs text-dark-muted">Reopen</span>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}
