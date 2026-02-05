import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { useState } from 'react'
import { useStore } from '../store/useStore'
import { Column as ColumnType, Task } from '../types'
import TaskCard from './TaskCard'

interface ColumnProps {
  column: ColumnType
  tasks: Task[]
  projectId: string
  projectPath?: string
  onTaskClick: (task: Task) => void
  onBranchChange?: () => void
}

export default function Column({
  column,
  tasks,
  projectId,
  projectPath,
  onTaskClick,
  onBranchChange
}: ColumnProps) {
  const { addTask } = useStore()
  const [isAdding, setIsAdding] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')

  const { setNodeRef, isOver } = useDroppable({
    id: column.id
  })

  const handleAddTask = () => {
    if (newTaskTitle.trim()) {
      addTask(projectId, newTaskTitle.trim(), column.id)
      setNewTaskTitle('')
      setIsAdding(false)
    }
  }

  const isBacklog = column.id === 'backlog'

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col flex-1 min-w-0 h-full rounded-lg overflow-hidden ${
        isOver ? 'bg-dark-hover' : 'bg-dark-card'
      } transition-colors`}
    >
      {/* Colored top border */}
      <div
        className="h-1 w-full"
        style={{ backgroundColor: column.color }}
      />

      {/* Column header */}
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-2">
          <h2 className="font-medium text-dark-text">{column.title}</h2>
          <span
            className="px-2 py-0.5 text-xs rounded-full font-medium"
            style={{
              backgroundColor: column.color + '25',
              color: column.color
            }}
          >
            {tasks.length}
          </span>
        </div>
        {/* Only show add button in Backlog column header */}
        {isBacklog && !isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="p-1 text-dark-muted hover:text-dark-text hover:bg-dark-hover rounded transition-colors"
            title="Add task"
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
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Add task form (only for Backlog) */}
      {isBacklog && isAdding && (
        <div className="px-2 pb-2 space-y-2">
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddTask()
              if (e.key === 'Escape') {
                setIsAdding(false)
                setNewTaskTitle('')
              }
            }}
            placeholder="Task title..."
            autoFocus
            className="w-full px-3 py-2 text-sm bg-dark-bg border border-dark-border rounded-lg focus:border-blue-500 outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAddTask}
              className="flex-1 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Add
            </button>
            <button
              onClick={() => {
                setIsAdding(false)
                setNewTaskTitle('')
              }}
              className="px-3 py-1.5 text-sm bg-dark-hover hover:bg-dark-border rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tasks */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2 column-scroll">
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick(task)}
              projectPath={projectPath}
              onBranchChange={onBranchChange}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  )
}
