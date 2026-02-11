import { contextBridge, ipcRenderer } from 'electron'

interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  isHidden: boolean
  size: number
  modifiedAt: string
}

interface GitStatus {
  isRepo: boolean
  branch: string
  ahead: number
  behind: number
  modified: number
  staged: number
  untracked: number
}

interface GitBranch {
  name: string
  current: boolean
}

interface GitCommit {
  hash: string
  shortHash: string
  message: string
  author: string
  authorEmail?: string
  date: string
  filesChanged?: number
  insertions?: number
  deletions?: number
}

interface GitDiffFile {
  file: string
  insertions: number
  deletions: number
  binary: boolean
}

interface GitChangedFile {
  file: string
  status: 'modified' | 'staged' | 'untracked' | 'deleted' | 'renamed' | 'conflicted'
  staged: boolean
}

interface UpdateStatus {
  status: 'checking' | 'available' | 'not-available'
  version?: string
}

contextBridge.exposeInMainWorld('electronAPI', {
  loadData: () => ipcRenderer.invoke('load-data'),
  openITerm: (projectPath: string) => ipcRenderer.invoke('open-iterm', projectPath),

  // Targeted database operations
  dbSaveLayout: (projectId: string, layout: unknown) =>
    ipcRenderer.invoke('db-save-layout', projectId, layout),
  dbSetAppState: (key: string, value: string | null) =>
    ipcRenderer.invoke('db-set-app-state', key, value),
  dbGetProjectByPath: (path: string): Promise<{ id: string; name: string; path: string; order: number } | null> =>
    ipcRenderer.invoke('db-get-project-by-path', path),
  dbUpsertProject: (project: { id: string; name: string; path: string; order: number }) =>
    ipcRenderer.invoke('db-upsert-project', project),
  dbDeleteProject: (id: string) =>
    ipcRenderer.invoke('db-delete-project', id),
  dbUpsertTask: (task: { id: string; projectId: string; title: string; description: string; column: string; labels: string[]; dueDate: string | null; createdAt: string; order: number; branch?: string; archived?: boolean; attachments?: unknown[] }) =>
    ipcRenderer.invoke('db-upsert-task', task),
  dbDeleteTask: (id: string) =>
    ipcRenderer.invoke('db-delete-task', id),
  dbBatchUpsertTasks: (tasks: Array<{ id: string; projectId: string; title: string; description: string; column: string; labels: string[]; dueDate: string | null; createdAt: string; order: number; branch?: string; archived?: boolean; attachments?: unknown[] }>) =>
    ipcRenderer.invoke('db-batch-upsert-tasks', tasks),
  dbUpsertLabel: (label: { id: string; name: string; color: string }) =>
    ipcRenderer.invoke('db-upsert-label', label),
  dbDeleteLabel: (id: string) =>
    ipcRenderer.invoke('db-delete-label', id),
  dbBatchUpsertProjects: (projects: Array<{ id: string; name: string; path: string; order: number }>) =>
    ipcRenderer.invoke('db-batch-upsert-projects', projects),
  selectFolder: () => ipcRenderer.invoke('select-folder'),

  // PTY methods - using terminalId for multiple terminals
  ptyCreate: (terminalId: string, projectPath: string) =>
    ipcRenderer.invoke('pty-create', terminalId, projectPath),
  ptyWrite: (terminalId: string, data: string) =>
    ipcRenderer.invoke('pty-write', terminalId, data),
  ptyResize: (terminalId: string, cols: number, rows: number) =>
    ipcRenderer.invoke('pty-resize', terminalId, cols, rows),
  ptyKill: (terminalId: string) => ipcRenderer.invoke('pty-kill', terminalId),
  ptyKillProject: (projectId: string) => ipcRenderer.invoke('pty-kill-project', projectId),
  ptyExists: (terminalId: string) => ipcRenderer.invoke('pty-exists', terminalId),
  ptyReconnect: (terminalId: string) => ipcRenderer.invoke('pty-reconnect', terminalId),
  onPtyData: (callback: (data: { terminalId: string; data: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { terminalId: string; data: string }) => {
      callback(payload)
    }
    ipcRenderer.on('pty-data', listener)
    return () => ipcRenderer.removeListener('pty-data', listener)
  },
  onPtyExit: (callback: (data: { terminalId: string; exitCode: number }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { terminalId: string; exitCode: number }) => {
      callback(payload)
    }
    ipcRenderer.on('pty-exit', listener)
    return () => ipcRenderer.removeListener('pty-exit', listener)
  },

  // File System methods
  fsReadDirectory: (dirPath: string): Promise<FileEntry[]> =>
    ipcRenderer.invoke('fs-read-directory', dirPath),
  fsReadFile: (filePath: string): Promise<string | null> =>
    ipcRenderer.invoke('fs-read-file', filePath),
  fsWriteFile: (filePath: string, content: string): Promise<boolean> =>
    ipcRenderer.invoke('fs-write-file', filePath, content),
  fsCreateFile: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke('fs-create-file', filePath),
  fsCreateDirectory: (dirPath: string): Promise<boolean> =>
    ipcRenderer.invoke('fs-create-directory', dirPath),
  fsRename: (oldPath: string, newPath: string): Promise<boolean> =>
    ipcRenderer.invoke('fs-rename', oldPath, newPath),
  fsDelete: (targetPath: string): Promise<boolean> =>
    ipcRenderer.invoke('fs-delete', targetPath),
  fsMove: (sourcePath: string, destDir: string): Promise<boolean> =>
    ipcRenderer.invoke('fs-move', sourcePath, destDir),
  fsExists: (targetPath: string): Promise<boolean> =>
    ipcRenderer.invoke('fs-exists', targetPath),
  fsShowInFolder: (targetPath: string): Promise<void> =>
    ipcRenderer.invoke('fs-show-in-folder', targetPath),

  // Git methods
  gitStatus: (projectPath: string): Promise<GitStatus> =>
    ipcRenderer.invoke('git-status', projectPath),
  gitChangedFiles: (projectPath: string): Promise<GitChangedFile[]> =>
    ipcRenderer.invoke('git-changed-files', projectPath),
  gitStatusWithFiles: (projectPath: string): Promise<{ status: GitStatus; files: GitChangedFile[] }> =>
    ipcRenderer.invoke('git-status-with-files', projectPath),
  gitBranches: (projectPath: string): Promise<GitBranch[]> =>
    ipcRenderer.invoke('git-branches', projectPath),
  gitLog: (projectPath: string, branch?: string, limit?: number): Promise<GitCommit[]> =>
    ipcRenderer.invoke('git-log', projectPath, branch, limit),
  gitCommitDetails: (projectPath: string, hash: string): Promise<GitCommit & { files: GitDiffFile[] }> =>
    ipcRenderer.invoke('git-commit-details', projectPath, hash),
  gitDiff: (projectPath: string, file: string, hash?: string): Promise<string> =>
    ipcRenderer.invoke('git-diff', projectPath, file, hash),
  gitShowFile: (projectPath: string, file: string, ref?: string): Promise<string | null> =>
    ipcRenderer.invoke('git-show-file', projectPath, file, ref),
  gitCheckout: (projectPath: string, branch: string): Promise<boolean> =>
    ipcRenderer.invoke('git-checkout', projectPath, branch),
  gitCreateBranch: (projectPath: string, branchName: string, baseBranch?: string): Promise<boolean> =>
    ipcRenderer.invoke('git-create-branch', projectPath, branchName, baseBranch),
  gitDeleteBranch: (projectPath: string, branchName: string): Promise<boolean> =>
    ipcRenderer.invoke('git-delete-branch', projectPath, branchName),
  gitStage: (projectPath: string, files: string[]): Promise<boolean> =>
    ipcRenderer.invoke('git-stage', projectPath, files),
  gitUnstage: (projectPath: string, files: string[]): Promise<boolean> =>
    ipcRenderer.invoke('git-unstage', projectPath, files),
  gitDiscard: (projectPath: string, files: string[]): Promise<boolean> =>
    ipcRenderer.invoke('git-discard', projectPath, files),
  gitCommit: (projectPath: string, message: string): Promise<boolean> =>
    ipcRenderer.invoke('git-commit', projectPath, message),
  gitPush: (projectPath: string): Promise<boolean> =>
    ipcRenderer.invoke('git-push', projectPath),
  gitPull: (projectPath: string): Promise<boolean> =>
    ipcRenderer.invoke('git-pull', projectPath),

  // Git Watcher methods
  gitWatch: (projectPath: string): Promise<boolean> =>
    ipcRenderer.invoke('git-watch', projectPath),
  gitUnwatch: (projectPath: string): Promise<boolean> =>
    ipcRenderer.invoke('git-unwatch', projectPath),
  onGitChanged: (callback: (projectPath: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, projectPath: string) => {
      callback(projectPath)
    }
    ipcRenderer.on('git-changed', listener)
    return () => ipcRenderer.removeListener('git-changed', listener)
  },

  // Auto Sync methods
  getAutoSync: (): Promise<boolean> => ipcRenderer.invoke('get-auto-sync'),
  setAutoSync: (enabled: boolean): Promise<boolean> => ipcRenderer.invoke('set-auto-sync', enabled),
  // Auto Save methods
  getAutoSave: (): Promise<boolean> => ipcRenderer.invoke('get-auto-save'),
  setAutoSave: (enabled: boolean): Promise<boolean> => ipcRenderer.invoke('set-auto-save', enabled),
  onAutoSaveChanged: (callback: (enabled: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, enabled: boolean) => {
      callback(enabled)
    }
    ipcRenderer.on('auto-save-changed', listener)
    return () => ipcRenderer.removeListener('auto-save-changed', listener)
  },
  onDataFileChanged: (callback: () => void) => {
    const listener = () => {
      callback()
    }
    ipcRenderer.on('data-file-changed', listener)
    return () => ipcRenderer.removeListener('data-file-changed', listener)
  },

  // Update methods
  updateCheck: () => ipcRenderer.invoke('update-check'),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version'),
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: UpdateStatus) => {
      callback(status)
    }
    ipcRenderer.on('update-status', listener)
    return () => ipcRenderer.removeListener('update-status', listener)
  },

  // Shell methods
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('open-external', url),

  // Attachment methods
  selectFiles: (): Promise<string[] | null> =>
    ipcRenderer.invoke('select-files'),
  copyFileToAttachments: (taskId: string, sourcePath: string): Promise<{ name: string; path: string; type: string; size: number } | null> =>
    ipcRenderer.invoke('copy-file-to-attachments', taskId, sourcePath),
  deleteAttachment: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke('delete-attachment', filePath),
  openAttachment: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke('open-attachment', filePath),
  getAttachmentDataUrl: (filePath: string): Promise<string | null> =>
    ipcRenderer.invoke('get-attachment-data-url', filePath),
  saveAttachmentData: (taskId: string, filename: string, base64Data: string): Promise<{ name: string; path: string; type: string; size: number } | null> =>
    ipcRenderer.invoke('save-attachment-data', taskId, filename, base64Data),
  deleteTaskAttachments: (taskId: string): Promise<boolean> =>
    ipcRenderer.invoke('delete-task-attachments', taskId),

  // Search methods
  searchFiles: (projectPath: string, query: string): Promise<{ path: string; name: string; relativePath: string }[]> =>
    ipcRenderer.invoke('search-files', projectPath, query),
  searchText: (projectPath: string, query: string): Promise<{ path: string; relativePath: string; line: number; content: string }[]> =>
    ipcRenderer.invoke('search-text', projectPath, query),

  // Hotkey Settings methods
  getHotkeySettings: (): Promise<Record<string, { key: string; meta?: boolean; shift?: boolean; alt?: boolean; ctrl?: boolean }>> =>
    ipcRenderer.invoke('get-hotkey-settings'),
  saveHotkeySettings: (overrides: Record<string, { key: string; meta?: boolean; shift?: boolean; alt?: boolean; ctrl?: boolean }>): Promise<boolean> =>
    ipcRenderer.invoke('save-hotkey-settings', overrides),

  // Notification Settings methods
  getNotificationSettings: (): Promise<{ soundEnabled: boolean; sound: string }> =>
    ipcRenderer.invoke('get-notification-settings'),
  saveNotificationSettings: (settings: { soundEnabled?: boolean; sound?: string }): Promise<boolean> =>
    ipcRenderer.invoke('save-notification-settings', settings),

  // App Zoom methods
  getAppZoom: (): Promise<number> => ipcRenderer.invoke('get-app-zoom'),
  setAppZoom: (factor: number): Promise<boolean> => ipcRenderer.invoke('set-app-zoom', factor),

  // Terminal Settings methods
  getTerminalSettings: (): Promise<{ terminalTheme?: string; terminalFontSize?: number; terminalFontFamily?: string } | null> =>
    ipcRenderer.invoke('get-terminal-settings'),
  saveTerminalSettings: (settings: { terminalTheme?: string; terminalFontSize?: number; terminalFontFamily?: string }): Promise<boolean> =>
    ipcRenderer.invoke('save-terminal-settings', settings),
  onTerminalZoom: (callback: (direction: 'in' | 'out' | 'reset') => void) => {
    const listener = (_event: Electron.IpcRendererEvent, direction: 'in' | 'out' | 'reset') => {
      callback(direction)
    }
    ipcRenderer.on('terminal-zoom', listener)
    return () => ipcRenderer.removeListener('terminal-zoom', listener)
  },

  // Image / File helpers
  findClaudeImage: (imageNumber: number): Promise<string | null> =>
    ipcRenderer.invoke('find-claude-image', imageNumber),
  fsReadFileBase64: (filePath: string): Promise<string | null> =>
    ipcRenderer.invoke('fs-read-file-base64', filePath),

  // Terminal State Persistence methods
  getTerminalStates: (): Promise<Record<string, { terminals: { id: string; name: string }[]; activeTerminalId: string; isSplitView: boolean }>> =>
    ipcRenderer.invoke('get-terminal-states'),
  saveTerminalStates: (states: Record<string, { terminals: { id: string; name: string }[]; activeTerminalId: string; isSplitView: boolean }>): Promise<boolean> =>
    ipcRenderer.invoke('save-terminal-states', states),
  deleteTerminalState: (projectId: string): Promise<boolean> =>
    ipcRenderer.invoke('delete-terminal-state', projectId),
  saveTerminalBuffer: (terminalId: string, content: string): Promise<boolean> =>
    ipcRenderer.invoke('save-terminal-buffer', terminalId, content),
  loadTerminalBuffer: (terminalId: string): Promise<string | null> =>
    ipcRenderer.invoke('load-terminal-buffer', terminalId),
  deleteTerminalBuffers: (projectId: string): Promise<boolean> =>
    ipcRenderer.invoke('delete-terminal-buffers', projectId),

  // System notification
  showSystemNotification: (options: { title: string; body: string }) =>
    ipcRenderer.invoke('show-system-notification', options),
})
