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
  const { tasks, reorderTasks } = useStore()
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  // Track target column locally during drag to avoid zustand's synchronous
  // re-render (via useSyncExternalStore) which causes an infinite loop with
  // @dnd-kit's collision detection firing onDragOver on every item change.
  const [dragOverColumn, setDragOverColumn] = useState<ColumnId | null>(null)
  const lastDragOverRef = useRef<string | null>(null)

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
      setDragOverColumn(null)
      setActiveTask(task)
    }
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event
    if (!over || !activeTask) return

    const overId = over.id as string

    // Current effective column (original or overridden by drag)
    const currentColumn = dragOverColumn ?? activeTask.column

    // Determine target column
    let targetColumn: ColumnId | null = null

    const overColumn = COLUMNS.find((c) => c.id === overId)
    if (overColumn && currentColumn !== overColumn.id) {
      targetColumn = overColumn.id
    } else {
      const overTask = projectTasks.find((t) => t.id === overId)
      if (overTask && currentColumn !== overTask.column) {
        targetColumn = overTask.column
      }
    }

    if (!targetColumn) return

    // Skip if we already moved this task to this column in this drag
    if (lastDragOverRef.current === targetColumn) return

    lastDragOverRef.current = targetColumn
    // Only update local React state — never the zustand store during drag
    setDragOverColumn(targetColumn)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    const finalColumn = dragOverColumn
    const draggedTask = activeTask

    setActiveTask(null)
    setDragOverColumn(null)
    lastDragOverRef.current = null

    if (!over || !draggedTask) return

    const activeId = active.id as string
    const overId = over.id as string

    const targetColumn = finalColumn ?? draggedTask.column

    // Cross-column move
    if (targetColumn !== draggedTask.column) {
      const targetColumnTasks = projectTasks
        .filter((t) => t.column === targetColumn)
        .sort((a, b) => a.order - b.order)
      const newTaskIds = targetColumnTasks.map((t) => t.id)
      // Insert at the position of the element we're hovering over, or at end
      const overIndex = newTaskIds.indexOf(overId)
      if (overIndex !== -1) {
        newTaskIds.splice(overIndex, 0, activeId)
      } else {
        newTaskIds.push(activeId)
      }
      // reorderTasks sets column + order for all listed tasks
      reorderTasks(targetColumn, newTaskIds)
      return
    }

    // Same-column reorder
    if (activeId === overId) return

    const columnTasks = projectTasks
      .filter((t) => t.column === targetColumn)
      .sort((a, b) => a.order - b.order)

    const oldIndex = columnTasks.findIndex((t) => t.id === activeId)
    const newIndex = columnTasks.findIndex((t) => t.id === overId)

    if (oldIndex !== -1 && newIndex !== -1) {
      const newTaskIds = [...columnTasks.map((t) => t.id)]
      newTaskIds.splice(oldIndex, 1)
      newTaskIds.splice(newIndex, 0, activeId)
      reorderTasks(targetColumn, newTaskIds)
    }
  }

  const getColumnTasks = (columnId: ColumnId) => {
    let colTasks = projectTasks.filter((t) => t.column === columnId)

    // During drag, visually move the active task between columns
    if (activeTask && dragOverColumn) {
      if (activeTask.column === columnId && dragOverColumn !== columnId) {
        // Remove from original column
        colTasks = colTasks.filter((t) => t.id !== activeTask.id)
      } else if (activeTask.column !== columnId && dragOverColumn === columnId) {
        // Add to target column
        colTasks = [...colTasks, { ...activeTask, column: columnId, order: colTasks.length }]
      }
    }

    return colTasks.sort((a, b) => a.order - b.order)
  }

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
