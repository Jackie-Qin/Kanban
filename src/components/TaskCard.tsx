import { useState, useCallback } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useStore } from '../store/useStore'
import { Task, TaskAttachment } from '../types'
import { electron } from '../lib/electron'
import { v4 as uuidv4 } from 'uuid'

interface TaskCardProps {
  task: Task
  onClick: () => void
  isDragging?: boolean
  projectPath?: string
  onBranchChange?: () => void
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)
  const diffWeek = Math.floor(diffDay / 7)
  const diffMonth = Math.floor(diffDay / 30)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  if (diffWeek < 4) return `${diffWeek}w ago`
  return `${diffMonth}mo ago`
}

export default function TaskCard({ task, onClick, isDragging, projectPath, onBranchChange }: TaskCardProps) {
  const { labels, updateTask, deleteTask } = useStore()
  const [isFileDragOver, setIsFileDragOver] = useState(false)

  // Handle OS file drops onto the card to add as attachments
  const handleFileDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = 'copy'
      setIsFileDragOver(true)
    }
  }, [])

  const handleFileDragLeave = useCallback((e: React.DragEvent) => {
    e.stopPropagation()
    setIsFileDragOver(false)
  }, [])

  const handleFileDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsFileDragOver(false)

    const files = e.dataTransfer.files
    if (!files.length) return

    const newAttachments: TaskAttachment[] = [...(task.attachments || [])]
    for (let i = 0; i < files.length; i++) {
      const file = files[i] as File & { path: string }
      const result = await electron.copyFileToAttachments(task.id, file.path)
      if (result) {
        newAttachments.push({
          id: uuidv4(),
          name: result.name,
          path: result.path,
          type: result.type,
          size: result.size,
          addedAt: new Date().toISOString()
        })
      }
    }
    updateTask(task.id, { attachments: newAttachments })
  }, [task.id, task.attachments, updateTask])

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  const taskLabels = labels.filter((l) => task.labels.includes(l.id))

  const formatDate = (date: string) => {
    const d = new Date(date)
    const now = new Date()
    const isOverdue = d < now
    const month = d.toLocaleString('default', { month: 'short' })
    const day = d.getDate()
    return { text: `${month} ${day}`, isOverdue }
  }

  const handleBranchBadgeClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!projectPath || !task.branch) return

    const success = await electron.gitCheckout(projectPath, task.branch)
    if (success) {
      onBranchChange?.()
    }
  }

  if (isSortableDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="p-3 bg-dark-hover border-2 border-dashed border-dark-border rounded-lg h-24 opacity-40"
      />
    )
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={onClick}
        onDragOver={handleFileDragOver}
        onDragLeave={handleFileDragLeave}
        onDrop={handleFileDrop}
        className={`p-3 bg-dark-bg border rounded-lg cursor-pointer hover:border-dark-muted transition-colors group relative ${
          isFileDragOver ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-500/5' : 'border-dark-border'
        } ${isDragging ? 'shadow-lg ring-2 ring-blue-500' : ''}`}
      >
        {/* Hover actions */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all z-10">
          {/* Drag to terminal handle */}
          <div
            draggable="true"
            onDragStart={(e) => {
              e.stopPropagation()
              // Set rich task data for terminal drop
              const taskData = {
                title: task.title,
                description: task.description || '',
                attachments: (task.attachments || []).map(a => ({ name: a.name, path: a.path, type: a.type }))
              }
              e.dataTransfer.setData('application/x-kanban-task', JSON.stringify(taskData))
              // Plain text fallback
              let text = `title: ${task.title}`
              if (task.description) text += `\ndescription: ${task.description}`
              if (task.attachments?.length) {
                text += `\nattachments: ${task.attachments.map(a => a.path).join(', ')}`
              }
              e.dataTransfer.setData('text/plain', text + '\n')
              e.dataTransfer.effectAllowed = 'copy'
            }}
            className="p-1 text-dark-muted hover:text-blue-400 hover:bg-dark-hover rounded cursor-grab"
            title="Drag to terminal to paste task info"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          {/* Archive button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              updateTask(task.id, { archived: !task.archived })
            }}
            className="p-1 text-dark-muted hover:text-yellow-400 hover:bg-dark-hover rounded"
            title={task.archived ? 'Unarchive task' : 'Archive task'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          </button>
          {/* Delete button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              deleteTask(task.id)
            }}
            className="p-1 text-dark-muted hover:text-red-400 hover:bg-dark-hover rounded"
            title="Delete task"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        {/* Archived indicator */}
        {task.archived && (
          <div className="absolute top-2 left-2 px-1.5 py-0.5 text-xs bg-dark-muted/20 text-dark-muted rounded">
            Archived
          </div>
        )}

        {/* Labels */}
        {taskLabels.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {taskLabels.map((label) => (
              <span
                key={label.id}
                className="px-2 py-0.5 text-xs rounded"
                style={{ backgroundColor: label.color + '30', color: label.color }}
              >
                {label.name}
              </span>
            ))}
          </div>
        )}

        {/* Title - 2 lines max */}
        <p className="text-sm text-dark-text line-clamp-2 leading-snug">{task.title}</p>

        {/* Branch badge */}
        {task.branch && (
          <button
            onClick={handleBranchBadgeClick}
            className="mt-2 flex items-center gap-1 text-xs text-green-400 hover:text-green-300 bg-green-400/10 hover:bg-green-400/20 px-2 py-0.5 rounded transition-colors"
            title="Click to checkout this branch"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            {task.branch}
          </button>
        )}

        {/* Description preview - 2 lines max */}
        {task.description && (
          <p className="mt-1.5 text-xs text-dark-muted line-clamp-2 leading-relaxed">
            {task.description}
          </p>
        )}

        {/* Footer: Created time, attachments, and due date */}
        <div className="mt-2 flex items-center justify-between text-xs text-dark-muted">
          {/* Created time */}
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {task.createdAt ? formatRelativeTime(task.createdAt) : 'Unknown'}
          </span>

          <div className="flex items-center gap-2">
            {/* Attachments count */}
            {task.attachments && task.attachments.length > 0 && (
              <span className="flex items-center gap-0.5">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                {task.attachments.length}
              </span>
            )}

            {/* Due date */}
            {task.dueDate && (
              <span
                className={`flex items-center gap-1 ${
                  formatDate(task.dueDate).isOverdue ? 'text-red-400' : ''
                }`}
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                {formatDate(task.dueDate).text}
              </span>
            )}
          </div>
        </div>
      </div>

    </>
  )
}
