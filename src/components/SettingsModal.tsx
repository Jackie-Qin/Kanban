import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'

interface SettingsModalProps {
  onClose: () => void
}

const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#6b7280'  // gray
]

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { labels, addLabel, updateLabel, deleteLabel } = useStore()
  const [newLabelName, setNewLabelName] = useState('')
  const [newLabelColor, setNewLabelColor] = useState(PRESET_COLORS[0])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingId) {
          setEditingId(null)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose, editingId])

  const handleAddLabel = () => {
    if (newLabelName.trim()) {
      addLabel(newLabelName.trim(), newLabelColor)
      setNewLabelName('')
      setNewLabelColor(PRESET_COLORS[0])
    }
  }

  const startEditing = (id: string) => {
    const label = labels.find((l) => l.id === id)
    if (label) {
      setEditingId(id)
      setEditName(label.name)
      setEditColor(label.color)
    }
  }

  const saveEdit = () => {
    if (editingId && editName.trim()) {
      updateLabel(editingId, { name: editName.trim(), color: editColor })
    }
    setEditingId(null)
  }

  const handleDeleteLabel = (id: string) => {
    if (confirm('Delete this label? It will be removed from all tasks.')) {
      deleteLabel(id)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-dark-card border border-dark-border rounded-xl shadow-2xl animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-border">
          <h2 className="text-lg font-semibold">Settings</h2>
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
        <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
          <h3 className="text-sm font-medium text-dark-muted">Labels</h3>

          {/* Existing labels */}
          <div className="space-y-2">
            {labels.map((label) => (
              <div key={label.id}>
                {editingId === label.id ? (
                  <div className="flex items-center gap-2 p-2 bg-dark-bg rounded-lg">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 px-2 py-1 bg-dark-card border border-dark-border rounded text-sm outline-none focus:border-blue-500"
                      autoFocus
                    />
                    <div className="flex gap-1">
                      {PRESET_COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={() => setEditColor(color)}
                          className={`w-5 h-5 rounded-full ${
                            editColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-dark-bg' : ''
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <button
                      onClick={saveEdit}
                      className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-2 bg-dark-bg rounded-lg group">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: label.color }}
                      />
                      <span className="text-sm">{label.name}</span>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEditing(label.id)}
                        className="p-1 text-dark-muted hover:text-dark-text hover:bg-dark-hover rounded"
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
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteLabel(label.id)}
                        className="p-1 text-dark-muted hover:text-red-400 hover:bg-dark-hover rounded"
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
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add new label */}
          <div className="pt-4 border-t border-dark-border">
            <p className="text-sm text-dark-muted mb-2">Add new label</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddLabel()
                }}
                placeholder="Label name"
                className="flex-1 px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-sm outline-none focus:border-blue-500"
              />
              <button
                onClick={handleAddLabel}
                disabled={!newLabelName.trim()}
                className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                Add
              </button>
            </div>
            <div className="flex gap-2 mt-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setNewLabelColor(color)}
                  className={`w-6 h-6 rounded-full ${
                    newLabelColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-dark-card' : ''
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-dark-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-dark-hover hover:bg-dark-border rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
