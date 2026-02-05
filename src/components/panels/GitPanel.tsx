import { useState, useEffect, useCallback, useRef } from 'react'
import { IDockviewPanelProps } from 'dockview'
import { electron, GitStatus, GitBranch, GitCommit, GitDiffFile, GitChangedFile } from '../../lib/electron'

interface GitPanelParams {
  projectId: string
  projectPath: string
}

// Format relative time
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export default function GitPanel({ params }: IDockviewPanelProps<GitPanelParams>) {
  const { projectPath } = params
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [changedFiles, setChangedFiles] = useState<GitChangedFile[]>([])
  const [branches, setBranches] = useState<GitBranch[]>([])
  const [commits, setCommits] = useState<GitCommit[]>([])
  const [selectedCommit, setSelectedCommit] = useState<(GitCommit & { files: GitDiffFile[] }) | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showBranchDropdown, setShowBranchDropdown] = useState(false)
  const [isCreatingBranch, setIsCreatingBranch] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [commitMessage, setCommitMessage] = useState('')
  const [isPushing, setIsPushing] = useState(false)
  const [isPulling, setIsPulling] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)

  // Resizable sections
  const [changesHeight, setChangesHeight] = useState(200)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const stagedFiles = changedFiles.filter(f => f.staged)
  const unstagedFiles = changedFiles.filter(f => !f.staged)

  const fetchData = useCallback(async () => {
    if (!projectPath) return

    setIsLoading(true)
    try {
      const [statusResult, changedFilesResult, branchesResult, commitsResult] = await Promise.all([
        electron.gitStatus(projectPath),
        electron.gitChangedFiles(projectPath),
        electron.gitBranches(projectPath),
        electron.gitLog(projectPath, undefined, 20)
      ])

      setStatus(statusResult)
      setChangedFiles(changedFilesResult)
      setBranches(branchesResult)
      setCommits(commitsResult)
    } catch (error) {
      console.error('Failed to fetch git data:', error)
    }
    setIsLoading(false)
  }, [projectPath])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Handle resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const newHeight = e.clientY - rect.top - 100 // Account for header
      setChangesHeight(Math.max(100, Math.min(newHeight, rect.height - 150)))
    }

    const handleMouseUp = () => setIsDragging(false)

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  const handleCheckout = async (branchName: string) => {
    const success = await electron.gitCheckout(projectPath, branchName)
    if (success) {
      setShowBranchDropdown(false)
      await fetchData()
    }
  }

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return
    const currentBranch = branches.find(b => b.current)?.name
    const success = await electron.gitCreateBranch(projectPath, newBranchName.trim(), currentBranch)
    if (success) {
      setIsCreatingBranch(false)
      setNewBranchName('')
      setShowBranchDropdown(false)
      await fetchData()
    }
  }

  const handleStage = async (files: string[]) => {
    await electron.gitStage(projectPath, files)
    await fetchData()
  }

  const handleUnstage = async (files: string[]) => {
    await electron.gitUnstage(projectPath, files)
    await fetchData()
  }

  const handleDiscard = async (file: string) => {
    if (!confirm(`Discard changes to ${file}?`)) return
    await electron.gitDiscard(projectPath, [file])
    await fetchData()
  }

  const handleCommit = async () => {
    if (!commitMessage.trim() || stagedFiles.length === 0) return
    setIsCommitting(true)
    const success = await electron.gitCommit(projectPath, commitMessage.trim())
    if (success) {
      setCommitMessage('')
      await fetchData()
    }
    setIsCommitting(false)
  }

  const handlePush = async () => {
    setIsPushing(true)
    await electron.gitPush(projectPath)
    await fetchData()
    setIsPushing(false)
  }

  const handlePull = async () => {
    setIsPulling(true)
    await electron.gitPull(projectPath)
    await fetchData()
    setIsPulling(false)
  }

  const handleCommitClick = async (commit: GitCommit) => {
    try {
      const details = await electron.gitCommitDetails(projectPath, commit.hash)
      setSelectedCommit(details)
    } catch (error) {
      console.error('Failed to fetch commit details:', error)
    }
  }

  const handleOpenFile = (filePath: string) => {
    const fullPath = `${projectPath}/${filePath}`
    window.dispatchEvent(
      new CustomEvent('editor:open-file', {
        detail: { path: fullPath, preview: false, projectPath, relativePath: filePath }
      })
    )
    window.dispatchEvent(
      new CustomEvent('panel:focus', { detail: { panelId: 'editor' } })
    )
  }

  const handleOpenChangedFile = (file: GitChangedFile) => {
    let filePath = file.file
    if (file.status === 'renamed' && file.file.includes(' → ')) {
      filePath = file.file.split(' → ')[1]
    }
    const fullPath = `${projectPath}/${filePath}`
    window.dispatchEvent(
      new CustomEvent('editor:open-file', {
        detail: { path: fullPath, preview: false, showDiff: true, projectPath, relativePath: filePath }
      })
    )
    window.dispatchEvent(
      new CustomEvent('panel:focus', { detail: { panelId: 'editor' } })
    )
  }

  const getStatusIcon = (status: GitChangedFile['status']) => {
    switch (status) {
      case 'modified':
        return <span className="text-yellow-400 font-bold text-xs">M</span>
      case 'staged':
        return <span className="text-green-400 font-bold text-xs">A</span>
      case 'untracked':
        return <span className="text-gray-400 font-bold text-xs">U</span>
      case 'deleted':
        return <span className="text-red-400 font-bold text-xs">D</span>
      case 'renamed':
        return <span className="text-blue-400 font-bold text-xs">R</span>
      case 'conflicted':
        return <span className="text-orange-400 font-bold text-xs">!</span>
      default:
        return null
    }
  }

  const getStatusColor = (status: GitChangedFile['status']) => {
    switch (status) {
      case 'modified': return 'text-yellow-400'
      case 'staged': return 'text-green-400'
      case 'untracked': return 'text-gray-400'
      case 'deleted': return 'text-red-400'
      case 'renamed': return 'text-blue-400'
      case 'conflicted': return 'text-orange-400'
      default: return ''
    }
  }

  const getFileNameFromPath = (file: string) => {
    if (file.includes(' → ')) {
      return file.split(' → ')[1]
    }
    return file
  }

  if (!status?.isRepo) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-dark-bg text-dark-muted">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <p className="text-lg font-medium">Not a Git Repository</p>
          <p className="text-sm mt-1 opacity-75">Initialize a repository to use Git features</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="h-full w-full flex flex-col bg-dark-bg text-dark-text overflow-hidden">
      {/* Header with branch dropdown */}
      <div className="px-4 py-3 border-b border-dark-border">
        <div className="flex items-center justify-between">
          <div className="relative">
            <button
              onClick={() => setShowBranchDropdown(!showBranchDropdown)}
              className="flex items-center gap-2 hover:bg-dark-hover px-2 py-1 rounded transition-colors"
            >
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              <span className="font-semibold text-green-400">{status.branch}</span>
              <svg className={`w-4 h-4 text-dark-muted transition-transform ${showBranchDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Branch dropdown */}
            {showBranchDropdown && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-dark-card border border-dark-border rounded-lg shadow-xl z-50 overflow-hidden">
                {/* Create branch input */}
                {isCreatingBranch ? (
                  <div className="p-2 border-b border-dark-border">
                    <input
                      type="text"
                      value={newBranchName}
                      onChange={(e) => setNewBranchName(e.target.value)}
                      placeholder="New branch name..."
                      className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateBranch()
                        if (e.key === 'Escape') {
                          setIsCreatingBranch(false)
                          setNewBranchName('')
                        }
                      }}
                    />
                    <div className="flex gap-1 mt-2">
                      <button
                        onClick={handleCreateBranch}
                        disabled={!newBranchName.trim()}
                        className="flex-1 px-2 py-1 text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded"
                      >
                        Create
                      </button>
                      <button
                        onClick={() => { setIsCreatingBranch(false); setNewBranchName('') }}
                        className="px-2 py-1 text-xs text-dark-muted hover:text-dark-text"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsCreatingBranch(true)}
                    className="w-full px-3 py-2 text-left text-sm text-blue-400 hover:bg-dark-hover border-b border-dark-border flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    New branch
                  </button>
                )}
                <div className="max-h-48 overflow-auto">
                  {branches.map((branch) => (
                    <button
                      key={branch.name}
                      onClick={() => handleCheckout(branch.name)}
                      disabled={branch.current}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-dark-hover flex items-center gap-2 ${
                        branch.current ? 'text-green-400 bg-dark-hover' : ''
                      }`}
                    >
                      {branch.current && <span className="w-2 h-2 rounded-full bg-green-400" />}
                      <span className={branch.current ? '' : 'ml-4'}>{branch.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Pull button */}
            {status.behind > 0 && (
              <button
                onClick={handlePull}
                disabled={isPulling}
                className="flex items-center gap-1 px-2 py-1 text-xs text-orange-400 hover:bg-dark-hover rounded transition-colors disabled:opacity-50"
                title={`Pull ${status.behind} commits`}
              >
                <svg className={`w-4 h-4 ${isPulling ? 'animate-pulse' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
                {status.behind}
              </button>
            )}
            {/* Push button */}
            {status.ahead > 0 && (
              <button
                onClick={handlePush}
                disabled={isPushing}
                className="flex items-center gap-1 px-2 py-1 text-xs text-blue-400 hover:bg-dark-hover rounded transition-colors disabled:opacity-50"
                title={`Push ${status.ahead} commits`}
              >
                <svg className={`w-4 h-4 ${isPushing ? 'animate-pulse' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                {status.ahead}
              </button>
            )}
            {/* Refresh button */}
            <button
              onClick={fetchData}
              disabled={isLoading}
              className="p-1.5 text-dark-muted hover:text-dark-text hover:bg-dark-hover rounded transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Close dropdown when clicking outside */}
      {showBranchDropdown && (
        <div className="fixed inset-0 z-40" onClick={() => setShowBranchDropdown(false)} />
      )}

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Changes section (resizable) */}
        <div style={{ height: changesHeight }} className="flex flex-col overflow-hidden border-b border-dark-border">
          <div className="overflow-auto flex-1">
            {/* Staged Changes */}
            {stagedFiles.length > 0 && (
              <div>
                <div className="flex items-center justify-between px-4 py-2 bg-dark-hover sticky top-0 z-10">
                  <span className="text-sm font-medium text-green-400">Staged ({stagedFiles.length})</span>
                  <button
                    onClick={() => handleUnstage(stagedFiles.map(f => getFileNameFromPath(f.file)))}
                    className="text-xs px-2 py-0.5 text-dark-muted hover:text-dark-text hover:bg-dark-border rounded transition-colors"
                    title="Unstage all"
                  >
                    − All
                  </button>
                </div>
                {stagedFiles.map((file, index) => (
                  <div
                    key={`staged-${file.file}-${index}`}
                    className="flex items-center gap-2 px-4 py-1.5 hover:bg-dark-hover cursor-pointer group"
                    onClick={() => handleOpenChangedFile(file)}
                  >
                    <span className="w-4 flex-shrink-0 flex items-center justify-center">
                      {getStatusIcon(file.status)}
                    </span>
                    <span className={`text-sm truncate flex-1 font-mono ${getStatusColor(file.status)}`}>
                      {file.file}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleUnstage([getFileNameFromPath(file.file)]) }}
                      className="p-1 opacity-0 group-hover:opacity-100 text-dark-muted hover:text-red-400 transition-all"
                      title="Unstage"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Unstaged Changes */}
            {unstagedFiles.length > 0 && (
              <div>
                <div className="flex items-center justify-between px-4 py-2 bg-dark-hover sticky top-0 z-10">
                  <span className="text-sm font-medium text-yellow-400">Changes ({unstagedFiles.length})</span>
                  <button
                    onClick={() => handleStage(unstagedFiles.map(f => getFileNameFromPath(f.file)))}
                    className="text-xs px-2 py-0.5 text-dark-muted hover:text-dark-text hover:bg-dark-border rounded transition-colors"
                    title="Stage all"
                  >
                    + All
                  </button>
                </div>
                {unstagedFiles.map((file, index) => (
                  <div
                    key={`unstaged-${file.file}-${index}`}
                    className="flex items-center gap-2 px-4 py-1.5 hover:bg-dark-hover cursor-pointer group"
                    onClick={() => handleOpenChangedFile(file)}
                  >
                    <span className="w-4 flex-shrink-0 flex items-center justify-center">
                      {getStatusIcon(file.status)}
                    </span>
                    <span className={`text-sm truncate flex-1 font-mono ${getStatusColor(file.status)}`}>
                      {file.file}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      {file.status !== 'untracked' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDiscard(getFileNameFromPath(file.file)) }}
                          className="p-1 text-dark-muted hover:text-orange-400"
                          title="Discard changes"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleStage([getFileNameFromPath(file.file)]) }}
                        className="p-1 text-dark-muted hover:text-green-400"
                        title="Stage"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Resize handle */}
        <div
          className="h-1 bg-dark-border hover:bg-blue-500 cursor-row-resize flex-shrink-0 transition-colors"
          onMouseDown={() => setIsDragging(true)}
        />

        {/* Commit section */}
        {stagedFiles.length > 0 && (
          <div className="px-4 py-3 border-b border-dark-border">
            <textarea
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Commit message..."
              className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
              rows={2}
            />
            <button
              onClick={handleCommit}
              disabled={!commitMessage.trim() || isCommitting}
              className="w-full mt-2 px-4 py-2 text-sm bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:hover:bg-green-600 text-white rounded transition-colors"
            >
              {isCommitting ? 'Committing...' : `Commit (${stagedFiles.length} file${stagedFiles.length > 1 ? 's' : ''})`}
            </button>
          </div>
        )}

        {/* Recent Commits */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="px-4 py-2 bg-dark-hover text-sm font-medium flex-shrink-0">
            Recent Commits
          </div>
          <div className="overflow-auto flex-1">
            {commits.map((commit) => (
              <div
                key={commit.hash}
                className="px-4 py-2 hover:bg-dark-hover cursor-pointer border-b border-dark-border"
                onClick={() => handleCommitClick(commit)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-blue-400 font-mono text-xs">{commit.shortHash}</span>
                  <span className="text-sm truncate flex-1">{commit.message}</span>
                  <span className="text-xs text-dark-muted">{formatRelativeTime(commit.date)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Commit Details Modal */}
      {selectedCommit && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setSelectedCommit(null)}
        >
          <div
            className="bg-dark-card border border-dark-border rounded-lg w-[600px] max-h-[80vh] overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-dark-border flex items-center justify-between">
              <div>
                <span className="text-blue-400 font-mono text-sm">{selectedCommit.shortHash}</span>
                <h3 className="font-semibold mt-1">{selectedCommit.message}</h3>
              </div>
              <button
                onClick={() => setSelectedCommit(null)}
                className="p-1 text-dark-muted hover:text-dark-text hover:bg-dark-hover rounded"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-4 py-3 border-b border-dark-border text-sm">
              <div className="text-dark-muted">
                Author: <span className="text-dark-text">{selectedCommit.author}</span>
              </div>
              <div className="text-dark-muted mt-1">
                Date: <span className="text-dark-text">{new Date(selectedCommit.date).toLocaleString()}</span>
              </div>
            </div>

            <div className="px-4 py-2 text-sm font-medium bg-dark-hover">
              Files changed ({selectedCommit.files.length}):
            </div>
            <div className="overflow-auto max-h-[300px]">
              {selectedCommit.files.map((file) => (
                <div
                  key={file.file}
                  className="px-4 py-2 flex items-center justify-between hover:bg-dark-hover border-b border-dark-border cursor-pointer"
                  onClick={() => handleOpenFile(file.file)}
                >
                  <span className="text-sm truncate flex-1 font-mono">{file.file}</span>
                  <div className="flex items-center gap-2 text-xs">
                    {file.insertions > 0 && <span className="text-green-400">+{file.insertions}</span>}
                    {file.deletions > 0 && <span className="text-red-400">-{file.deletions}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
