import { useState, useEffect, useCallback } from 'react'
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
  const [isCreatingBranch, setIsCreatingBranch] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [baseBranch, setBaseBranch] = useState('')
  const [isLoading, setIsLoading] = useState(false)

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

      // Set default base branch
      if (branchesResult.length > 0) {
        const current = branchesResult.find((b) => b.current)
        setBaseBranch(current?.name || branchesResult[0].name)
      }
    } catch (error) {
      console.error('Failed to fetch git data:', error)
    }
    setIsLoading(false)
  }, [projectPath])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCheckout = async (branchName: string) => {
    const success = await electron.gitCheckout(projectPath, branchName)
    if (success) {
      await fetchData()
    }
  }

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return

    const success = await electron.gitCreateBranch(projectPath, newBranchName.trim(), baseBranch)
    if (success) {
      setIsCreatingBranch(false)
      setNewBranchName('')
      await fetchData()
    }
  }

  const handleDeleteBranch = async (branchName: string) => {
    const confirmed = window.confirm(`Delete branch "${branchName}"?`)
    if (!confirmed) return

    const success = await electron.gitDeleteBranch(projectPath, branchName)
    if (success) {
      await fetchData()
    } else {
      alert(`Failed to delete branch "${branchName}". It may not exist or is the current branch.`)
      // Refresh anyway to update stale branches
      await fetchData()
    }
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
    // Dispatch event to open file in editor
    const fullPath = `${projectPath}/${filePath}`
    window.dispatchEvent(
      new CustomEvent('editor:open-file', {
        detail: { path: fullPath, preview: false, projectPath, relativePath: filePath }
      })
    )
    // Switch to editor panel
    window.dispatchEvent(
      new CustomEvent('panel:focus', { detail: { panelId: 'editor' } })
    )
  }

  const handleOpenChangedFile = (file: GitChangedFile) => {
    // For renamed files, extract the new name
    let filePath = file.file
    if (file.status === 'renamed' && file.file.includes(' → ')) {
      filePath = file.file.split(' → ')[1]
    }

    // Dispatch event to open file in editor with diff mode
    const fullPath = `${projectPath}/${filePath}`
    window.dispatchEvent(
      new CustomEvent('editor:open-file', {
        detail: { path: fullPath, preview: false, showDiff: true, projectPath, relativePath: filePath }
      })
    )
    // Switch to editor panel
    window.dispatchEvent(
      new CustomEvent('panel:focus', { detail: { panelId: 'editor' } })
    )
  }

  const getStatusIcon = (status: GitChangedFile['status']) => {
    switch (status) {
      case 'modified':
        return <span className="text-yellow-400 font-bold text-xs">M</span>
      case 'staged':
        return <span className="text-green-400 font-bold text-xs">S</span>
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

  if (!status?.isRepo) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-dark-bg text-dark-muted">
        <div className="text-center">
          <svg
            className="w-16 h-16 mx-auto mb-4 opacity-50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          <p className="text-lg font-medium">Not a Git Repository</p>
          <p className="text-sm mt-1 opacity-75">
            Initialize a repository to use Git features
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full flex flex-col bg-dark-bg text-dark-text overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-dark-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            <span className="font-semibold text-green-400">{status.branch}</span>
          </div>
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

        {/* Status summary */}
        <div className="flex items-center gap-3 mt-2 text-sm text-dark-muted">
          {status.ahead > 0 && <span className="text-blue-400">↑{status.ahead} ahead</span>}
          {status.behind > 0 && <span className="text-orange-400">↓{status.behind} behind</span>}
          {status.modified > 0 && <span className="text-yellow-400">●{status.modified} modified</span>}
          {status.staged > 0 && <span className="text-green-400">●{status.staged} staged</span>}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {/* Changed Files Section */}
        {changedFiles.length > 0 && (
          <div className="border-b border-dark-border">
            <div className="px-4 py-2 bg-dark-hover text-sm font-medium">
              Changes ({changedFiles.length})
            </div>
            <div className="max-h-48 overflow-auto">
              {changedFiles.map((file, index) => (
                <div
                  key={`${file.file}-${index}`}
                  className="flex items-center gap-2 px-4 py-1.5 hover:bg-dark-hover cursor-pointer group"
                  onClick={() => handleOpenChangedFile(file)}
                  title={`${file.status}${file.staged ? ' (staged)' : ''}: ${file.file}`}
                >
                  <span className="w-4 flex-shrink-0 flex items-center justify-center">
                    {getStatusIcon(file.status)}
                  </span>
                  <span className={`text-sm truncate flex-1 font-mono ${getStatusColor(file.status)}`}>
                    {file.file}
                  </span>
                  <svg
                    className="w-4 h-4 text-dark-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Branches Section */}
        <div className="border-b border-dark-border">
          <div className="flex items-center justify-between px-4 py-2 bg-dark-hover">
            <span className="text-sm font-medium">Branches</span>
            <button
              onClick={() => setIsCreatingBranch(true)}
              className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            >
              + New
            </button>
          </div>

          {isCreatingBranch && (
            <div className="px-4 py-2 bg-dark-card border-b border-dark-border">
              <input
                type="text"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="Branch name..."
                className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1 text-sm mb-2 focus:outline-none focus:border-blue-500"
                autoFocus
              />
              <div className="flex items-center gap-2 text-sm">
                <span className="text-dark-muted">from:</span>
                <select
                  value={baseBranch}
                  onChange={(e) => setBaseBranch(e.target.value)}
                  className="flex-1 bg-dark-bg border border-dark-border rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                >
                  {branches.map((b) => (
                    <option key={b.name} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={handleCreateBranch}
                  disabled={!newBranchName.trim()}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm rounded transition-colors"
                >
                  Create & Checkout
                </button>
                <button
                  onClick={() => {
                    setIsCreatingBranch(false)
                    setNewBranchName('')
                  }}
                  className="px-3 py-1 text-dark-muted hover:text-dark-text text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="max-h-40 overflow-auto">
            {branches.map((branch) => (
              <div
                key={branch.name}
                className={`flex items-center justify-between px-4 py-2 hover:bg-dark-hover cursor-pointer group ${
                  branch.current ? 'bg-dark-hover' : ''
                }`}
                onClick={() => !branch.current && handleCheckout(branch.name)}
              >
                <div className="flex items-center gap-2">
                  {branch.current ? (
                    <span className="w-2 h-2 rounded-full bg-green-400" />
                  ) : (
                    <span className="w-2 h-2" />
                  )}
                  <span className={`text-sm ${branch.current ? 'text-green-400 font-medium' : ''}`}>
                    {branch.name}
                  </span>
                </div>
                {!branch.current && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteBranch(branch.name)
                    }}
                    className="p-1 opacity-0 group-hover:opacity-100 text-red-400 hover:bg-dark-border rounded transition-all"
                    title="Delete branch"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Recent Commits Section */}
        <div>
          <div className="px-4 py-2 bg-dark-hover text-sm font-medium">
            Recent Commits
          </div>
          <div>
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
            {/* Header */}
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

            {/* Details */}
            <div className="px-4 py-3 border-b border-dark-border text-sm">
              <div className="text-dark-muted">
                Author: <span className="text-dark-text">{selectedCommit.author}</span>
              </div>
              <div className="text-dark-muted mt-1">
                Date: <span className="text-dark-text">{new Date(selectedCommit.date).toLocaleString()}</span>
              </div>
            </div>

            {/* Changed Files */}
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
                    <button className="p-1 text-dark-muted hover:text-dark-text hover:bg-dark-border rounded">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
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
