import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { electron } from '../lib/electron'

interface AddProjectModalProps {
  onClose: () => void
}

export default function AddProjectModal({ onClose }: AddProjectModalProps) {
  const { addProject } = useStore()
  const [name, setName] = useState('')
  const [path, setPath] = useState('')

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const handleSelectFolder = async () => {
    const selectedPath = await electron.selectFolder()
    if (selectedPath) {
      setPath(selectedPath)
      // Auto-fill name from folder name if empty
      if (!name) {
        const folderName = selectedPath.split('/').pop() || ''
        setName(folderName)
      }
    }
  }

  const handleSubmit = () => {
    if (name.trim() && path.trim()) {
      addProject(name.trim(), path.trim())
      onClose()
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
          <h2 className="text-lg font-semibold">New Project</h2>
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
          {/* Project name */}
          <div>
            <label className="block text-sm text-dark-muted mb-1">
              Project Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Project"
              autoFocus
              className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg focus:border-blue-500 outline-none"
            />
          </div>

          {/* Folder path */}
          <div>
            <label className="block text-sm text-dark-muted mb-1">
              Project Folder
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/path/to/project"
                className="flex-1 px-3 py-2 bg-dark-bg border border-dark-border rounded-lg focus:border-blue-500 outline-none"
              />
              <button
                onClick={handleSelectFolder}
                className="px-3 py-2 bg-dark-hover hover:bg-dark-border rounded-lg transition-colors"
                title="Browse"
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
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-dark-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-dark-hover hover:bg-dark-border rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || !path.trim()}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            Create Project
          </button>
        </div>
      </div>
    </div>
  )
}
