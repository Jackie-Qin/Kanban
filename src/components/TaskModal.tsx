import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { Task } from '../types'

interface TaskModalProps {
  task: Task
  onClose: () => void
}

export default function TaskModal({ task, onClose }: TaskModalProps) {
  const { labels, updateTask, deleteTask } = useStore()
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description)
  const [selectedLabels, setSelectedLabels] = useState<string[]>(task.labels)
  const [dueDate, setDueDate] = useState(task.dueDate || '')

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const handleSave = () => {
    updateTask(task.id, {
      title,
      description,
      labels: selectedLabels,
      dueDate: dueDate || null
    })
    onClose()
  }

  const handleDelete = () => {
    if (confirm('Delete this task?')) {
      deleteTask(task.id)
      onClose()
    }
  }

  const toggleLabel = (labelId: string) => {
    setSelectedLabels((prev) =>
      prev.includes(labelId)
        ? prev.filter((id) => id !== labelId)
        : [...prev, labelId]
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-dark-card border border-dark-border rounded-xl shadow-2xl animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-border">
          <h2 className="text-lg font-semibold">Edit Task</h2>
          <button
            onClick={onClose}
            className="p-1 text-dark-muted hover:text-dark-text hover:bg-dark-hover rounded"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm text-dark-muted mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg focus:border-blue-500 outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-dark-muted mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={8}
              placeholder="Add a description..."
              className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg focus:border-blue-500 outline-none resize-none"
            />
          </div>

          {/* Labels */}
          <div>
            <label className="block text-sm text-dark-muted mb-2">Labels</label>
            <div className="flex flex-wrap gap-2">
              {labels.map((label) => (
                <button
                  key={label.id}
                  onClick={() => toggleLabel(label.id)}
                  className={`px-3 py-1 text-sm rounded-full transition-all ${
                    selectedLabels.includes(label.id)
                      ? 'ring-2 ring-offset-2 ring-offset-dark-card'
                      : 'opacity-60 hover:opacity-100'
                  }`}
                  style={{
                    backgroundColor: label.color + '30',
                    color: label.color,
                    ['--tw-ring-color' as string]: label.color
                  }}
                >
                  {label.name}
                </button>
              ))}
            </div>
          </div>

          {/* Due date */}
          <div>
            <label className="block text-sm text-dark-muted mb-1">
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-dark-border">
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            Delete
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-dark-hover hover:bg-dark-border rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
