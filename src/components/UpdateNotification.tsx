import { useEffect, useState } from 'react'
import { electron } from '../lib/electron'

interface UpdateStatus {
  status: 'checking' | 'available' | 'not-available'
  version?: string
}

const RELEASES_URL = 'https://github.com/Jackie-Qin/Kanban/releases/latest'

export default function UpdateNotification() {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)

  useEffect(() => {
    const cleanup = window.electronAPI.onUpdateStatus((status) => {
      setUpdateStatus(status)
      if (status.status === 'available') {
        setDismissed(false)
      }
    })
    return cleanup
  }, [])

  const openReleasesPage = () => {
    electron.openExternal(RELEASES_URL)
  }

  const copyCommand = () => {
    navigator.clipboard.writeText('xattr -dr com.apple.quarantine /Applications/Kanban.app')
  }

  if (!updateStatus || dismissed) return null

  if (updateStatus.status === 'available') {
    return (
      <div className="fixed bottom-4 right-4 bg-[#1e1e1e] border border-dark-border rounded-lg shadow-lg p-4 max-w-md z-50">
        <div className="flex items-start gap-3">
          <div className="text-blue-400 mt-0.5">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="text-dark-text font-medium">Update Available</h4>
            <p className="text-dark-muted text-sm mt-1">
              Version {updateStatus.version} is available.
            </p>

            {showInstructions ? (
              <div className="mt-3 text-sm">
                <p className="text-dark-muted mb-2">After downloading:</p>
                <ol className="text-dark-muted list-decimal list-inside space-y-1 mb-3">
                  <li>Replace the app in /Applications</li>
                  <li>Run this command in Terminal:</li>
                </ol>
                <div className="flex items-center gap-2 bg-dark-bg rounded p-2">
                  <code className="text-xs text-green-400 flex-1 break-all">
                    xattr -dr com.apple.quarantine /Applications/Kanban.app
                  </code>
                  <button
                    onClick={copyCommand}
                    className="p-1 text-dark-muted hover:text-dark-text transition-colors flex-shrink-0"
                    title="Copy command"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={openReleasesPage}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                  >
                    Download
                  </button>
                  <button
                    onClick={() => setDismissed(true)}
                    className="px-3 py-1.5 text-dark-muted hover:text-dark-text text-sm transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setShowInstructions(true)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                >
                  Update
                </button>
                <button
                  onClick={() => setDismissed(true)}
                  className="px-3 py-1.5 text-dark-muted hover:text-dark-text text-sm transition-colors"
                >
                  Later
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return null
}
