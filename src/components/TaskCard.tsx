import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useStore } from '../store/useStore'
import { Task } from '../types'
import { electron } from '../lib/electron'

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

// Generate branch name from task title
function generateBranchName(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50)
  return `feature/${slug}`
}

export default function TaskCard({ task, onClick, isDragging, projectPath, onBranchChange }: TaskCardProps) {
  const { labels, updateTask, deleteTask } = useStore()
  const [showBranchModal, setShowBranchModal] = useState(false)
  const [branchName, setBranchName] = useState('')
  const [baseBranch, setBaseBranch] = useState('main')
  const [branches, setBranches] = useState<string[]>([])
  const [isCreating, setIsCreating] = useState(false)

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

  const handleOpenBranchModal = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!projectPath) return

    // Fetch branches
    const branchList = await electron.gitBranches(projectPath)
    setBranches(branchList.map((b) => b.name))

    // Set default values
    setBranchName(generateBranchName(task.title))
    const current = branchList.find((b) => b.current)
    setBaseBranch(current?.name || 'main')

    setShowBranchModal(true)
  }

  const handleCreateBranch = async () => {
    if (!projectPath || !branchName.trim()) return

    setIsCreating(true)
    try {
      const success = await electron.gitCreateBranch(projectPath, branchName.trim(), baseBranch)
      if (success) {
        // Link branch to task
        updateTask(task.id, { branch: branchName.trim() })
        setShowBranchModal(false)
        onBranchChange?.()
      }
    } catch (error) {
      console.error('Failed to create branch:', error)
    }
    setIsCreating(false)
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
        className={`p-3 bg-dark-bg border border-dark-border rounded-lg cursor-pointer hover:border-dark-muted transition-colors group relative ${
          isDragging ? 'shadow-lg ring-2 ring-blue-500' : ''
        }`}
      >
        {/* Hover actions */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all z-10">
          {/* Create Branch button (shown if no branch linked) */}
          {projectPath && !task.branch && (
            <button
              onClick={handleOpenBranchModal}
              className="p-1 text-dark-muted hover:text-green-400 hover:bg-dark-hover rounded"
              title="Create branch for this task"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </button>
          )}
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

        {/* Footer: Created time and due date */}
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

      {/* Create Branch Modal */}
      {showBranchModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowBranchModal(false)}
        >
          <div
            className="bg-dark-card border border-dark-border rounded-lg w-[400px] p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold mb-4">Create Branch</h3>

            <div className="mb-4">
              <label className="block text-sm text-dark-muted mb-1">Branch name</label>
              <input
                type="text"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                autoFocus
              />
              <p className="text-xs text-dark-muted mt-1">Auto-generated from task title</p>
            </div>

            <div className="mb-4">
              <label className="block text-sm text-dark-muted mb-1">Base branch</label>
              <select
                value={baseBranch}
                onChange={(e) => setBaseBranch(e.target.value)}
                className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              >
                {branches.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowBranchModal(false)}
                className="px-4 py-2 text-sm text-dark-muted hover:text-dark-text"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBranch}
                disabled={!branchName.trim() || isCreating}
                className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded transition-colors"
              >
                {isCreating ? 'Creating...' : 'Create & Checkout'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
