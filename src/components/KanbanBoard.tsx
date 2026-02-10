import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import { useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { COLUMNS, Task, ColumnId } from '../types'
import Column from './Column'
import TaskCard from './TaskCard'

interface KanbanBoardProps {
  projectId: string
  projectPath?: string
  onTaskClick: (task: Task, isNew?: boolean) => void
  onBranchChange?: () => void
}

export default function KanbanBoard({ projectId, projectPath, onTaskClick, onBranchChange }: KanbanBoardProps) {
  const { tasks, moveTask, reorderTasks } = useStore()
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const lastDragOverRef = useRef<{ taskId: string; column: ColumnId } | null>(null)

  const projectTasks = tasks.filter((t) => t.projectId === projectId && (showArchived || !t.archived))
  const archivedCount = tasks.filter((t) => t.projectId === projectId && t.archived).length

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    const task = projectTasks.find((t) => t.id === event.active.id)
    if (task) {
      lastDragOverRef.current = null
      setActiveTask(task)
    }
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const activeTask = projectTasks.find((t) => t.id === activeId)
    if (!activeTask) return

    // Determine target column
    let targetColumn: ColumnId | null = null
    let targetOrder = 0

    const overColumn = COLUMNS.find((c) => c.id === overId)
    if (overColumn && activeTask.column !== overColumn.id) {
      targetColumn = overColumn.id
      targetOrder = 0
    } else {
      const overTask = projectTasks.find((t) => t.id === overId)
      if (overTask && activeTask.column !== overTask.column) {
        targetColumn = overTask.column
        targetOrder = overTask.order
      }
    }

    if (!targetColumn) return

    // Skip if we already moved this task to this column in this drag
    const last = lastDragOverRef.current
    if (last && last.taskId === activeId && last.column === targetColumn) return

    lastDragOverRef.current = { taskId: activeId, column: targetColumn }
    moveTask(activeId, targetColumn, targetOrder)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)
    lastDragOverRef.current = null

    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    if (activeId === overId) return

    const activeTask = projectTasks.find((t) => t.id === activeId)
    if (!activeTask) return

    // Find which column the task is in
    const columnId = activeTask.column
    const columnTasks = projectTasks
      .filter((t) => t.column === columnId)
      .sort((a, b) => a.order - b.order)

    const oldIndex = columnTasks.findIndex((t) => t.id === activeId)
    const newIndex = columnTasks.findIndex((t) => t.id === overId)

    if (oldIndex !== -1 && newIndex !== -1) {
      const newTaskIds = [...columnTasks.map((t) => t.id)]
      newTaskIds.splice(oldIndex, 1)
      newTaskIds.splice(newIndex, 0, activeId)
      reorderTasks(columnId, newTaskIds)
    }
  }

  const getColumnTasks = (columnId: ColumnId) =>
    projectTasks
      .filter((t) => t.column === columnId)
      .sort((a, b) => a.order - b.order)

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Archive toggle */}
      {archivedCount > 0 && (
        <div className="flex-shrink-0 px-4 pt-2 pb-1">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-2 text-sm text-dark-muted hover:text-dark-text transition-colors"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showArchived ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span>{showArchived ? 'Hide' : 'Show'} archived ({archivedCount})</span>
          </button>
        </div>
      )}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 pt-2 hide-scrollbar">
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 h-full w-full">
          {COLUMNS.map((column) => (
            <Column
              key={column.id}
              column={column}
              tasks={getColumnTasks(column.id)}
              projectId={projectId}
              projectPath={projectPath}
              onTaskClick={onTaskClick}
              onBranchChange={onBranchChange}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask && (
            <TaskCard
              task={activeTask}
              onClick={() => {}}
              isDragging
            />
          )}
        </DragOverlay>
      </DndContext>
      </div>
    </div>
  )
}
