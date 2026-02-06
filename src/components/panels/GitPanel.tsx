import { useState, useEffect, useCallback, useRef } from 'react'
import { IDockviewPanelProps } from 'dockview'
import { electron, GitStatus, GitBranch, GitCommit, GitDiffFile, GitChangedFile } from '../../lib/electron'
import FileIcon from '../FileIcon'

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

export default function GitPanel({ api, params }: IDockviewPanelProps<GitPanelParams>) {
  // Use internal state for projectPath to reliably detect project switches
  const [projectPath, setProjectPath] = useState(params.projectPath)

  // Sync from React params prop
  useEffect(() => {
    if (params.projectPath && params.projectPath !== projectPath) {
      setProjectPath(params.projectPath)
    }
  }, [params.projectPath])

  // Also sync from dockview API event (more reliable for panel.update() calls)
  useEffect(() => {
    const disposable = api.onDidParametersChange(() => {
      const p = api.getParameters() as GitPanelParams
      if (p?.projectPath) {
        setProjectPath(prev => prev === p.projectPath ? prev : p.projectPath)
      }
    })
    return () => disposable.dispose()
  }, [api])

  const [status, setStatus] = useState<GitStatus | null>(null)
  const [changedFiles, setChangedFiles] = useState<GitChangedFile[]>([])
  const [branches, setBranches] = useState<GitBranch[]>([])
  const [commits, setCommits] = useState<GitCommit[]>([])
  const [selectedCommit, setSelectedCommit] = useState<(GitCommit & { files: GitDiffFile[] }) | null>(null)
  const [showBranchDropdown, setShowBranchDropdown] = useState(false)
  const [isCreatingBranch, setIsCreatingBranch] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [commitMessage, setCommitMessage] = useState('')
  const [isPushing, setIsPushing] = useState(false)
  const [isPulling, setIsPulling] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)
  const [gitError, setGitError] = useState<string | null>(null)

  // Hover tooltip
  const [hoveredCommit, setHoveredCommit] = useState<{ commit: GitCommit & { files: GitDiffFile[] }; x: number; y: number } | null>(null)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Multi-select
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [lastClickedFileKey, setLastClickedFileKey] = useState<string | null>(null)

  // Track whether this panel tab is active (visible)
  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    setIsActive(api.isActive)
    const disposable = api.onDidActiveChange((e) => {
      setIsActive(e.isActive)
    })
    return () => disposable.dispose()
  }, [api])

  // Resizable sections
  const [changesHeight, setChangesHeight] = useState(200)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Clear stale data when switching projects
  useEffect(() => {
    setStatus(null)
    setChangedFiles([])
    setBranches([])
    setCommits([])
    setSelectedCommit(null)
    setHoveredCommit(null)
    setSelectedFiles(new Set())
    setLastClickedFileKey(null)
    setCommitMessage('')
    setShowBranchDropdown(false)
    setGitError(null)
  }, [projectPath])

  // Auto-dismiss error after 4 seconds
  useEffect(() => {
    if (!gitError) return
    const timeout = setTimeout(() => setGitError(null), 4000)
    return () => clearTimeout(timeout)
  }, [gitError])

  // Track the current projectPath via ref to detect stale async responses
  const activePathRef = useRef(projectPath)
  activePathRef.current = projectPath

  // Generation counter: only the latest fetchData call's results are applied
  const fetchGenRef = useRef(0)

  const stagedFiles = changedFiles.filter(f => f.staged)
  const unstagedFiles = changedFiles.filter(f => !f.staged)

  const fetchData = useCallback(async () => {
    if (!projectPath) return

    const gen = ++fetchGenRef.current
    const pathAtStart = projectPath

    try {
      const [statusWithFiles, branchesResult, commitsResult] = await Promise.all([
        electron.gitStatusWithFiles(projectPath),
        electron.gitBranches(projectPath),
        electron.gitLog(projectPath, undefined, 20)
      ])

      // Discard if project changed or a newer fetch was started
      if (activePathRef.current !== pathAtStart || fetchGenRef.current !== gen) return

      setStatus(statusWithFiles.status)
      setChangedFiles(statusWithFiles.files)
      setBranches(branchesResult)
      setCommits(commitsResult)
    } catch (error) {
      console.error('Failed to fetch git data:', error)
    }
  }, [projectPath])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Watch .git directory for changes
  useEffect(() => {
    if (!projectPath) return
    electron.gitWatch(projectPath)
    const unsubscribe = electron.onGitChanged((changedPath) => {
      if (changedPath === projectPath) fetchData()
    })
    return () => {
      unsubscribe()
      electron.gitUnwatch(projectPath)
    }
  }, [projectPath, fetchData])

  // Refresh when window gains focus
  useEffect(() => {
    const handleFocus = () => fetchData()
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [fetchData])

  // Poll for working tree changes (edits don't trigger .git watcher)
  // Only poll when panel is active to avoid redundant subprocess calls
  useEffect(() => {
    if (!projectPath || !isActive) return
    // Refresh immediately when becoming active
    fetchData()
    const interval = setInterval(fetchData, 3000)
    return () => clearInterval(interval)
  }, [projectPath, isActive, fetchData])

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
    const success = await electron.gitStage(projectPath, files)
    if (!success) setGitError('Failed to stage files')
    await fetchData()
  }

  const handleUnstage = async (files: string[]) => {
    const success = await electron.gitUnstage(projectPath, files)
    if (!success) setGitError('Failed to unstage files')
    await fetchData()
  }

  const handleDiscard = async (file: string) => {
    if (!confirm(`Discard changes to ${file}?`)) return
    const success = await electron.gitDiscard(projectPath, [file])
    if (!success) setGitError(`Failed to discard changes to ${file}`)
    await fetchData()
  }

  const handleDiscardAll = async () => {
    const modifiedFiles = unstagedFiles.filter(f => f.status !== 'untracked').map(f => getFileNameFromPath(f.file))
    if (modifiedFiles.length === 0) return
    if (!confirm(`Discard all changes to ${modifiedFiles.length} file(s)?`)) return
    const success = await electron.gitDiscard(projectPath, modifiedFiles)
    if (!success) setGitError('Failed to discard changes')
    await fetchData()
  }

  const handleCommit = async () => {
    if (!commitMessage.trim() || stagedFiles.length === 0) return
    setIsCommitting(true)
    const success = await electron.gitCommit(projectPath, commitMessage.trim())
    if (success) {
      setCommitMessage('')
      await fetchData()
    } else {
      setGitError('Commit failed — check for pre-commit hooks or conflicts')
    }
    setIsCommitting(false)
  }

  const handlePush = async () => {
    setIsPushing(true)
    const success = await electron.gitPush(projectPath)
    if (!success) setGitError('Push failed — check remote and network')
    await fetchData()
    setIsPushing(false)
  }

  const handlePull = async () => {
    setIsPulling(true)
    const success = await electron.gitPull(projectPath)
    if (!success) setGitError('Pull failed — check for conflicts or network issues')
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

  // Multi-select helpers
  const selectedStagedFiles = stagedFiles.filter(f => selectedFiles.has(`staged:${f.file}`))
  const selectedUnstagedFiles = unstagedFiles.filter(f => selectedFiles.has(`unstaged:${f.file}`))

  const handleFileClick = (e: React.MouseEvent, file: GitChangedFile, section: 'staged' | 'unstaged', fileList: GitChangedFile[]) => {
    const fileKey = `${section}:${file.file}`

    if (e.metaKey || e.ctrlKey) {
      e.preventDefault()
      setSelectedFiles(prev => {
        const next = new Set(prev)
        if (next.has(fileKey)) next.delete(fileKey)
        else next.add(fileKey)
        return next
      })
      setLastClickedFileKey(fileKey)
    } else if (e.shiftKey && lastClickedFileKey) {
      e.preventDefault()
      const allKeys = fileList.map(f => `${section}:${f.file}`)
      const lastIdx = allKeys.indexOf(lastClickedFileKey)
      const currIdx = allKeys.indexOf(fileKey)
      if (lastIdx >= 0 && currIdx >= 0) {
        const [from, to] = [Math.min(lastIdx, currIdx), Math.max(lastIdx, currIdx)]
        setSelectedFiles(prev => {
          const next = new Set(prev)
          for (let i = from; i <= to; i++) next.add(allKeys[i])
          return next
        })
      }
    } else {
      setSelectedFiles(new Set())
      setLastClickedFileKey(null)
      handleOpenChangedFile(file)
    }
  }

  const handleStageSelected = async () => {
    const files = selectedUnstagedFiles.map(f => getFileNameFromPath(f.file))
    if (files.length === 0) return
    await handleStage(files)
    setSelectedFiles(new Set())
  }

  const handleUnstageSelected = async () => {
    const files = selectedStagedFiles.map(f => getFileNameFromPath(f.file))
    if (files.length === 0) return
    await handleUnstage(files)
    setSelectedFiles(new Set())
  }

  const handleDiscardSelected = async () => {
    const files = selectedUnstagedFiles.filter(f => f.status !== 'untracked').map(f => getFileNameFromPath(f.file))
    if (files.length === 0) return
    if (!confirm(`Discard changes to ${files.length} file(s)?`)) return
    await electron.gitDiscard(projectPath, files)
    await fetchData()
    setSelectedFiles(new Set())
  }

  const handleCommitHover = (commit: GitCommit, e: React.MouseEvent) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    hoverTimeoutRef.current = setTimeout(async () => {
      try {
        const details = await electron.gitCommitDetails(projectPath, commit.hash)
        const x = Math.min(e.clientX, window.innerWidth - 340)
        const y = Math.min(e.clientY + 10, window.innerHeight - 250)
        setHoveredCommit({ commit: details, x, y })
      } catch {
        // ignore
      }
    }, 500)
  }

  const handleCommitHoverLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    setHoveredCommit(null)
  }

  const getFileNameFromPath = (file: string) => {
    if (file.includes(' → ')) {
      return file.split(' → ')[1]
    }
    return file
  }

  const getFileDisplayParts = (filePath: string) => {
    const parts = filePath.split('/')
    const filename = parts[parts.length - 1]
    const directory = parts.length > 1 ? parts.slice(0, -1).join('/') : ''
    return { filename, directory }
  }

  const getStatusLetter = (file: GitChangedFile): { letter: string; color: string } => {
    switch (file.status) {
      case 'modified': return { letter: 'M', color: 'text-yellow-400' }
      case 'staged': return { letter: 'A', color: 'text-green-400' }
      case 'untracked': return { letter: 'U', color: 'text-gray-400' }
      case 'deleted': return { letter: 'D', color: 'text-red-400' }
      case 'renamed': return { letter: 'R', color: 'text-blue-400' }
      case 'conflicted': return { letter: '!', color: 'text-orange-400' }
      default: return { letter: '?', color: 'text-dark-muted' }
    }
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
              className="p-1.5 text-dark-muted hover:text-dark-text hover:bg-dark-hover rounded transition-colors"
              title="Refresh"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {gitError && (
        <div className="px-4 py-2 bg-red-500/15 border-b border-red-500/30 flex items-center gap-2">
          <span className="text-xs text-red-400 flex-1">{gitError}</span>
          <button
            onClick={() => setGitError(null)}
            className="p-0.5 text-red-400 hover:text-red-300"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

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
                  <span className="text-sm font-medium text-green-400">
                    Staged ({stagedFiles.length})
                    {selectedStagedFiles.length > 0 && (
                      <span className="text-dark-muted font-normal"> · {selectedStagedFiles.length} selected</span>
                    )}
                  </span>
                  <div className="flex items-center gap-1">
                    {selectedStagedFiles.length > 0 && (
                      <button
                        onClick={handleUnstageSelected}
                        className="text-xs px-2 py-0.5 text-orange-400 hover:text-orange-300 hover:bg-dark-border rounded transition-colors"
                        title="Unstage selected"
                      >
                        − Selected
                      </button>
                    )}
                    <button
                      onClick={() => handleUnstage(stagedFiles.map(f => getFileNameFromPath(f.file)))}
                      className="text-xs px-2 py-0.5 text-dark-muted hover:text-dark-text hover:bg-dark-border rounded transition-colors"
                      title="Unstage all"
                    >
                      − All
                    </button>
                  </div>
                </div>
                {stagedFiles.map((file, index) => {
                  const { filename, directory } = getFileDisplayParts(file.file)
                  const statusInfo = getStatusLetter(file)
                  const isSelected = selectedFiles.has(`staged:${file.file}`)
                  return (
                    <div
                      key={`staged-${file.file}-${index}`}
                      className={`flex items-center gap-2 px-4 h-7 hover:bg-dark-hover cursor-pointer group ${isSelected ? 'bg-blue-500/20' : ''}`}
                      onClick={(e) => handleFileClick(e, file, 'staged', stagedFiles)}
                    >
                      <FileIcon name={filename} className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm truncate">{filename}</span>
                      {directory && (
                        <span className="text-xs text-dark-muted truncate">{directory}</span>
                      )}
                      <span className="flex-1" />
                      <span className={`text-xs font-mono ${statusInfo.color} group-hover:hidden flex-shrink-0`}>
                        {statusInfo.letter}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleUnstage([getFileNameFromPath(file.file)]) }}
                        className="p-1 hidden group-hover:block text-dark-muted hover:text-red-400 transition-colors flex-shrink-0"
                        title="Unstage"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Unstaged Changes */}
            {unstagedFiles.length > 0 && (
              <div>
                <div className="flex items-center justify-between px-4 py-2 bg-dark-hover sticky top-0 z-10">
                  <span className="text-sm font-medium text-yellow-400">
                    Changes ({unstagedFiles.length})
                    {selectedUnstagedFiles.length > 0 && (
                      <span className="text-dark-muted font-normal"> · {selectedUnstagedFiles.length} selected</span>
                    )}
                  </span>
                  <div className="flex items-center gap-1">
                    {selectedUnstagedFiles.length > 0 ? (
                      <>
                        {selectedUnstagedFiles.some(f => f.status !== 'untracked') && (
                          <button
                            onClick={handleDiscardSelected}
                            className="text-xs px-2 py-0.5 text-orange-400 hover:text-orange-300 hover:bg-dark-border rounded transition-colors"
                            title="Discard selected"
                          >
                            Revert
                          </button>
                        )}
                        <button
                          onClick={handleStageSelected}
                          className="text-xs px-2 py-0.5 text-green-400 hover:text-green-300 hover:bg-dark-border rounded transition-colors"
                          title="Stage selected"
                        >
                          + Selected
                        </button>
                      </>
                    ) : (
                      <>
                        {unstagedFiles.some(f => f.status !== 'untracked') && (
                          <button
                            onClick={handleDiscardAll}
                            className="text-xs px-2 py-0.5 text-dark-muted hover:text-orange-400 hover:bg-dark-border rounded transition-colors"
                            title="Discard all changes"
                          >
                            Revert
                          </button>
                        )}
                        <button
                          onClick={() => handleStage(unstagedFiles.map(f => getFileNameFromPath(f.file)))}
                          className="text-xs px-2 py-0.5 text-dark-muted hover:text-dark-text hover:bg-dark-border rounded transition-colors"
                          title="Stage all"
                        >
                          + All
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {unstagedFiles.map((file, index) => {
                  const { filename, directory } = getFileDisplayParts(file.file)
                  const statusInfo = getStatusLetter(file)
                  const isSelected = selectedFiles.has(`unstaged:${file.file}`)
                  return (
                    <div
                      key={`unstaged-${file.file}-${index}`}
                      className={`flex items-center gap-2 px-4 h-7 hover:bg-dark-hover cursor-pointer group ${isSelected ? 'bg-blue-500/20' : ''}`}
                      onClick={(e) => handleFileClick(e, file, 'unstaged', unstagedFiles)}
                    >
                      <FileIcon name={filename} className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm truncate">{filename}</span>
                      {directory && (
                        <span className="text-xs text-dark-muted truncate">{directory}</span>
                      )}
                      <span className="flex-1" />
                      <span className={`text-xs font-mono ${statusInfo.color} group-hover:hidden flex-shrink-0`}>
                        {statusInfo.letter}
                      </span>
                      <div className="hidden group-hover:flex items-center gap-1 flex-shrink-0">
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
                  )
                })}
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

        {/* Recent Commits with Graph */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="px-4 py-2 bg-dark-hover text-sm font-medium flex-shrink-0">
            Recent Commits
          </div>
          <div className="overflow-auto flex-1">
            {commits.map((commit, index) => {
              const isLocal = status ? index < status.ahead : false
              const isFirst = index === 0
              const isLast = index === commits.length - 1
              const isOriginHead = status ? index === status.ahead : false
              const dotColor = isLocal ? 'bg-green-400' : 'bg-blue-400'
              const lineColor = isLocal ? 'bg-green-400/40' : 'bg-blue-400/40'
              // Next commit's line color (for bottom segment)
              const nextIsLocal = status ? (index + 1) < status.ahead : false
              const bottomLineColor = isLast ? 'bg-transparent' : (nextIsLocal ? 'bg-green-400/40' : 'bg-blue-400/40')

              return (
                <div
                  key={commit.hash}
                  className="flex hover:bg-dark-hover cursor-pointer"
                  onClick={() => handleCommitClick(commit)}
                  onMouseEnter={(e) => handleCommitHover(commit, e)}
                  onMouseLeave={handleCommitHoverLeave}
                >
                  {/* Graph column */}
                  <div className="w-8 flex-shrink-0 flex flex-col items-center">
                    {/* Top line segment */}
                    <div className={`w-0.5 flex-1 ${isFirst ? 'bg-transparent' : lineColor}`} />
                    {/* Dot */}
                    <div className={`w-2.5 h-2.5 rounded-full ${dotColor} flex-shrink-0`} />
                    {/* Bottom line segment */}
                    <div className={`w-0.5 flex-1 ${bottomLineColor}`} />
                  </div>

                  {/* Commit info */}
                  <div className="flex-1 min-w-0 py-1.5 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm truncate flex-1">{commit.message}</span>
                      <span className="text-xs text-dark-muted flex-shrink-0">{formatRelativeTime(commit.date)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`font-mono text-[10px] ${isLocal ? 'text-green-400/70' : 'text-blue-400/70'}`}>{commit.shortHash}</span>
                      {/* Local HEAD badge */}
                      {isFirst && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0 rounded-full text-[10px] font-medium bg-green-400/15 text-green-400 border border-green-400/30">
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                          </svg>
                          {status?.branch}
                        </span>
                      )}
                      {/* Origin HEAD badge */}
                      {isOriginHead && status && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0 rounded-full text-[10px] font-medium bg-blue-400/15 text-blue-400 border border-blue-400/30">
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                          </svg>
                          origin/{status.branch}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Commit Hover Tooltip */}
      {hoveredCommit && (
        <div
          className="fixed z-50 bg-dark-card border border-dark-border rounded-lg shadow-xl p-3 w-80"
          style={{ left: hoveredCommit.x, top: hoveredCommit.y }}
          onMouseEnter={() => {
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
          }}
          onMouseLeave={handleCommitHoverLeave}
        >
          <div className="flex items-center gap-2.5 mb-2">
            {(() => {
              // Try GitHub username from noreply email, fall back to author name
              const email = hoveredCommit.commit.authorEmail || ''
              const noreplyMatch = email.match(/^(\d+\+)?(.+)@users\.noreply\.github\.com$/)
              const githubUsername = noreplyMatch ? noreplyMatch[2] : hoveredCommit.commit.author
              const initials = hoveredCommit.commit.author.charAt(0).toUpperCase()
              return (
                <div className="w-8 h-8 flex-shrink-0 relative">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-medium">
                    {initials}
                  </div>
                  <img
                    src={`https://github.com/${githubUsername}.png?size=64`}
                    alt=""
                    className="w-8 h-8 rounded-full absolute inset-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                </div>
              )
            })()}
            <div className="min-w-0">
              <div className="text-sm font-medium text-dark-text">{hoveredCommit.commit.author}</div>
              <div className="text-xs text-dark-muted">
                {formatRelativeTime(hoveredCommit.commit.date)} ({new Date(hoveredCommit.commit.date).toLocaleString()})
              </div>
            </div>
          </div>
          <div className="text-sm mb-2 break-words">{hoveredCommit.commit.message}</div>
          <div className="space-y-1 text-xs text-dark-muted">
            {hoveredCommit.commit.files && hoveredCommit.commit.files.length > 0 && (
              <div className="flex items-center gap-2 pt-1 border-t border-dark-border mt-1">
                <span>{hoveredCommit.commit.files.length} file{hoveredCommit.commit.files.length !== 1 ? 's' : ''}</span>
                {(() => {
                  const ins = hoveredCommit.commit.files.reduce((s, f) => s + f.insertions, 0)
                  const del = hoveredCommit.commit.files.reduce((s, f) => s + f.deletions, 0)
                  return (
                    <>
                      {ins > 0 && <span className="text-green-400">+{ins}</span>}
                      {del > 0 && <span className="text-red-400">-{del}</span>}
                    </>
                  )
                })()}
              </div>
            )}
            <div className="flex items-center gap-1 pt-1 border-t border-dark-border mt-1">
              <span className="font-mono text-[10px] text-dark-muted">{hoveredCommit.commit.hash}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  navigator.clipboard.writeText(hoveredCommit.commit.hash)
                }}
                className="p-0.5 text-dark-muted hover:text-dark-text"
                title="Copy full hash"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

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
