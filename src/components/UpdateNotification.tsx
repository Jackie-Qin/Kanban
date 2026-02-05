import { useEffect, useState } from 'react'

interface UpdateStatus {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  version?: string
  percent?: number
  message?: string
}

export default function UpdateNotification() {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const cleanup = window.electronAPI.onUpdateStatus((status) => {
      setUpdateStatus(status)
      if (status.status === 'available') {
        setDismissed(false)
      }
    })
    return cleanup
  }, [])

  if (!updateStatus || dismissed) return null

  if (updateStatus.status === 'available') {
    return (
      <div className="fixed bottom-4 right-4 bg-[#1e1e1e] border border-dark-border rounded-lg shadow-lg p-4 max-w-sm z-50">
        <div className="flex items-start gap-3">
          <div className="text-blue-400 mt-0.5">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="text-dark-text font-medium">Update Available</h4>
            <p className="text-dark-muted text-sm mt-1">
              Version {updateStatus.version} is ready to download.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => window.electronAPI.updateDownload()}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
              >
                Download
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="px-3 py-1.5 text-dark-muted hover:text-dark-text text-sm transition-colors"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (updateStatus.status === 'downloading') {
    return (
      <div className="fixed bottom-4 right-4 bg-[#1e1e1e] border border-dark-border rounded-lg shadow-lg p-4 max-w-sm z-50">
        <div className="flex items-center gap-3">
          <div className="text-blue-400 animate-pulse">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="text-dark-text font-medium">Downloading Update...</h4>
            <div className="mt-2 h-1.5 bg-dark-border rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${updateStatus.percent || 0}%` }}
              />
            </div>
            <p className="text-dark-muted text-xs mt-1">
              {Math.round(updateStatus.percent || 0)}%
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (updateStatus.status === 'downloaded') {
    return (
      <div className="fixed bottom-4 right-4 bg-[#1e1e1e] border border-dark-border rounded-lg shadow-lg p-4 max-w-sm z-50">
        <div className="flex items-start gap-3">
          <div className="text-green-400 mt-0.5">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="text-dark-text font-medium">Update Ready</h4>
            <p className="text-dark-muted text-sm mt-1">
              Restart to apply the update.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => window.electronAPI.updateInstall()}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
              >
                Restart Now
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="px-3 py-1.5 text-dark-muted hover:text-dark-text text-sm transition-colors"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (updateStatus.status === 'error') {
    return (
      <div className="fixed bottom-4 right-4 bg-[#1e1e1e] border border-red-500/50 rounded-lg shadow-lg p-4 max-w-sm z-50">
        <div className="flex items-start gap-3">
          <div className="text-red-400 mt-0.5 flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-dark-text font-medium">Update Error</h4>
            <p className="text-dark-muted text-sm mt-1 break-words">
              {updateStatus.message || 'Failed to check for updates'}
            </p>
            <button
              onClick={() => setDismissed(true)}
              className="mt-2 text-dark-muted hover:text-dark-text text-sm transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
