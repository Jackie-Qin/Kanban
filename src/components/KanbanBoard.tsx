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
import { useState } from 'react'
import { useStore } from '../store/useStore'
import { COLUMNS, Task, ColumnId } from '../types'
import Column from './Column'
import TaskCard from './TaskCard'

interface KanbanBoardProps {
  projectId: string
  projectPath?: string
  onTaskClick: (task: Task) => void
  onBranchChange?: () => void
}

export default function KanbanBoard({ projectId, projectPath, onTaskClick, onBranchChange }: KanbanBoardProps) {
  const { tasks, moveTask, reorderTasks } = useStore()
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  const projectTasks = tasks.filter((t) => t.projectId === projectId)

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

    // Check if dropping over a column
    const overColumn = COLUMNS.find((c) => c.id === overId)
    if (overColumn && activeTask.column !== overColumn.id) {
      moveTask(activeId, overColumn.id, 0)
      return
    }

    // Check if dropping over another task
    const overTask = projectTasks.find((t) => t.id === overId)
    if (overTask && activeTask.column !== overTask.column) {
      moveTask(activeId, overTask.column, overTask.order)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)

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
    <div className="h-full overflow-x-auto overflow-y-hidden p-4 hide-scrollbar">
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
  )
}
