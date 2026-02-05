import { useState, useEffect, useCallback } from 'react'
import { Project } from '../types'
import { electron, GitStatus } from '../lib/electron'

interface ProjectHeaderProps {
  project: Project
  onRunDev: () => void
}

export default function ProjectHeader({
  project,
  onRunDev
}: ProjectHeaderProps) {
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null)

  const fetchGitStatus = useCallback(async () => {
    if (!project.path) return
    const status = await electron.gitStatus(project.path)
    setGitStatus(status)
  }, [project.path])

  // Watch .git directory for changes
  useEffect(() => {
    fetchGitStatus()
    if (!project.path) return
    electron.gitWatch(project.path)
    const unsubscribe = electron.onGitChanged((changedPath) => {
      if (changedPath === project.path) fetchGitStatus()
    })
    return () => {
      unsubscribe()
      electron.gitUnwatch(project.path)
    }
  }, [fetchGitStatus, project.path])

  // Refresh on window focus
  useEffect(() => {
    const handleFocus = () => fetchGitStatus()
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [fetchGitStatus])

  return (
    <div className="flex items-center justify-between px-6 py-3 border-b border-dark-border bg-dark-card">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-lg font-semibold text-white">{project.name}</h1>
          <p className="text-sm text-dark-muted truncate max-w-md">{project.path}</p>
        </div>

        {/* Git Status */}
        {gitStatus?.isRepo && (
          <div className="flex items-center gap-3 text-sm">
            {/* Branch */}
            <span className="flex items-center gap-1.5 text-green-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              {gitStatus.branch}
            </span>

            {/* Ahead/Behind */}
            {(gitStatus.ahead > 0 || gitStatus.behind > 0) && (
              <span className="flex items-center gap-1 text-dark-muted">
                {gitStatus.ahead > 0 && (
                  <span className="text-blue-400" title="Commits ahead">
                    ↑{gitStatus.ahead}
                  </span>
                )}
                {gitStatus.behind > 0 && (
                  <span className="text-orange-400" title="Commits behind">
                    ↓{gitStatus.behind}
                  </span>
                )}
              </span>
            )}

            {/* Modified files */}
            {gitStatus.modified > 0 && (
              <span className="flex items-center gap-1 text-yellow-400" title="Modified files">
                <span className="w-2 h-2 rounded-full bg-yellow-400" />
                {gitStatus.modified} modified
              </span>
            )}

            {/* Staged files */}
            {gitStatus.staged > 0 && (
              <span className="flex items-center gap-1 text-green-400" title="Staged files">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                {gitStatus.staged} staged
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Refresh Git Status */}
        {gitStatus?.isRepo && (
          <button
            onClick={fetchGitStatus}
            className="p-2 text-dark-muted hover:text-dark-text hover:bg-dark-hover rounded-lg transition-colors"
            title="Refresh Git status"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}

        {/* Run Dev button */}
        <button
          onClick={onRunDev}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          title="Run npm run dev"
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
              d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Run Dev
        </button>
      </div>
    </div>
  )
}
