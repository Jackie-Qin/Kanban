import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { Task, TaskAttachment } from '../types'
import { electron } from '../lib/electron'
import { v4 as uuidv4 } from 'uuid'

interface TaskModalProps {
  task: Task
  onClose: () => void
  isNew?: boolean
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function TaskModal({ task, onClose, isNew }: TaskModalProps) {
  const { labels, updateTask, deleteTask } = useStore()
  const [title, setTitle] = useState(task.title === 'New Task' ? '' : task.title)
  const [description, setDescription] = useState(task.description)
  const [selectedLabels, setSelectedLabels] = useState<string[]>(task.labels)
  const [dueDate, setDueDate] = useState(task.dueDate || '')
  const [attachments, setAttachments] = useState<TaskAttachment[]>(task.attachments || [])
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({})

  // Load thumbnails for image attachments
  useEffect(() => {
    const loadThumbnails = async () => {
      const newThumbnails: Record<string, string> = {}
      for (const att of attachments) {
        if (att.type.startsWith('image/')) {
          const dataUrl = await electron.getAttachmentDataUrl(att.path)
          if (dataUrl) newThumbnails[att.id] = dataUrl
        }
      }
      setThumbnails(newThumbnails)
    }
    loadThumbnails()
  }, [attachments])

  const handleCancel = () => {
    if (isNew) {
      deleteTask(task.id)
    }
    onClose()
  }

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCancel()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isNew])

  const handleSave = () => {
    updateTask(task.id, {
      title: title.trim() || 'Untitled',
      description,
      labels: selectedLabels,
      dueDate: dueDate || null,
      attachments
    })
    onClose()
  }

  // Handle paste for images from clipboard
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const blob = item.getAsFile()
        if (!blob) continue

        // Capture type info synchronously before async read
        const mimeType = blob.type || item.type || 'image/png'
        const subtype = mimeType.split('/')[1] || 'png'
        const ext = subtype === 'jpeg' ? 'jpg' : subtype
        const filename = `pasted-image-${Date.now()}.${ext}`

        // Convert blob to base64
        const reader = new FileReader()
        reader.onload = async () => {
          const dataUrl = reader.result as string
          const base64 = dataUrl.split(',')[1]

          const result = await electron.saveAttachmentData(task.id, filename, base64)
          if (result) {
            const newAttachment: TaskAttachment = {
              id: uuidv4(),
              name: result.name,
              path: result.path,
              type: result.type,
              size: result.size,
              addedAt: new Date().toISOString()
            }
            setAttachments((prev) => [...prev, newAttachment])
          }
        }
        reader.readAsDataURL(blob)
      }
    }
  }

  const handleDeleteAttachment = async (att: TaskAttachment) => {
    await electron.deleteAttachment(att.path)
    setAttachments((prev) => prev.filter((a) => a.id !== att.id))
  }

  const handleOpenAttachment = (att: TaskAttachment) => {
    electron.openAttachment(att.path)
  }

  const handleDelete = () => {
    deleteTask(task.id)
    onClose()
  }

  const handleArchive = () => {
    updateTask(task.id, { archived: !task.archived })
    onClose()
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
      onClick={handleCancel}
    >
      <div
        className="w-full max-w-lg bg-dark-card border border-dark-border rounded-xl shadow-2xl animate-slideUp"
        onClick={(e) => e.stopPropagation()}
        onPaste={handlePaste}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-border">
          <h2 className="text-lg font-semibold">{isNew ? 'New Task' : 'Edit Task'}</h2>
          <button
            onClick={handleCancel}
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

          {/* Attachments */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm text-dark-muted">Attachments</label>
              <span className="text-xs text-dark-muted">Paste images or drag files to card</span>
            </div>
            {attachments.length > 0 ? (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {attachments.map((att) => (
                  <div key={att.id} className="flex items-center gap-2 p-2 bg-dark-bg border border-dark-border rounded-lg group">
                    {/* Thumbnail or file icon */}
                    {thumbnails[att.id] ? (
                      <img src={thumbnails[att.id]} alt={att.name} className="w-8 h-8 object-cover rounded flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 flex items-center justify-center bg-dark-hover rounded flex-shrink-0">
                        <svg className="w-4 h-4 text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    {/* File info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-dark-text truncate">{att.name}</p>
                      <p className="text-xs text-dark-muted">{formatFileSize(att.size)}</p>
                    </div>
                    {/* Actions */}
                    <button
                      onClick={() => handleOpenAttachment(att)}
                      className="p-1 text-dark-muted hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Open file"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteAttachment(att)}
                      className="p-1 text-dark-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove attachment"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-dark-muted italic">No attachments</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-dark-border">
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              className="px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              Delete
            </button>
            {!isNew && (
              <button
                onClick={handleArchive}
                className="px-4 py-2 text-sm text-dark-muted hover:bg-dark-hover rounded-lg transition-colors"
              >
                {task.archived ? 'Unarchive' : 'Archive'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
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
