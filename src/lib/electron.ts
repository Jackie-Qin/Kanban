import { AppData } from '../types'

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  isHidden: boolean
  size: number
  modifiedAt: string
}

export interface GitStatus {
  isRepo: boolean
  branch: string
  ahead: number
  behind: number
  modified: number
  staged: number
  untracked: number
}

export interface GitBranch {
  name: string
  current: boolean
}

export interface GitCommit {
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

export interface GitDiffFile {
  file: string
  insertions: number
  deletions: number
  binary: boolean
}

export interface GitChangedFile {
  file: string
  status: 'modified' | 'staged' | 'untracked' | 'deleted' | 'renamed' | 'conflicted'
  staged: boolean
}

export interface UpdateStatus {
  status: 'checking' | 'available' | 'not-available'
  version?: string
}

export interface SearchFileResult {
  path: string
  name: string
  relativePath: string
}

export interface SearchTextResult {
  path: string
  relativePath: string
  line: number
  content: string
}

declare global {
  interface Window {
    electronAPI: {
      loadData: () => Promise<AppData>
      openITerm: (projectPath: string) => Promise<boolean>
      selectFolder: () => Promise<string | null>
      // Targeted database operations
      dbSaveLayout: (projectId: string, layout: unknown) => Promise<boolean>
      dbSetAppState: (key: string, value: string | null) => Promise<boolean>
      dbUpsertProject: (project: { id: string; name: string; path: string; order: number }) => Promise<boolean>
      dbDeleteProject: (id: string) => Promise<boolean>
      dbUpsertTask: (task: { id: string; projectId: string; title: string; description: string; column: string; labels: string[]; dueDate: string | null; createdAt: string; order: number; branch?: string; archived?: boolean; attachments?: unknown[] }) => Promise<boolean>
      dbDeleteTask: (id: string) => Promise<boolean>
      dbBatchUpsertTasks: (tasks: Array<{ id: string; projectId: string; title: string; description: string; column: string; labels: string[]; dueDate: string | null; createdAt: string; order: number; branch?: string; archived?: boolean; attachments?: unknown[] }>) => Promise<boolean>
      dbUpsertLabel: (label: { id: string; name: string; color: string }) => Promise<boolean>
      dbDeleteLabel: (id: string) => Promise<boolean>
      dbBatchUpsertProjects: (projects: Array<{ id: string; name: string; path: string; order: number }>) => Promise<boolean>
      // PTY methods - using terminalId for multiple terminals
      ptyCreate: (terminalId: string, projectPath: string) => Promise<boolean>
      ptyWrite: (terminalId: string, data: string) => Promise<boolean>
      ptyResize: (terminalId: string, cols: number, rows: number) => Promise<boolean>
      ptyKill: (terminalId: string) => Promise<boolean>
      ptyExists: (terminalId: string) => Promise<boolean>
      ptyReconnect: (terminalId: string) => Promise<string | null>
      onPtyData: (callback: (data: { terminalId: string; data: string }) => void) => () => void
      onPtyExit: (callback: (data: { terminalId: string; exitCode: number }) => void) => () => void
      // File System methods
      fsReadDirectory: (dirPath: string) => Promise<FileEntry[]>
      fsReadFile: (filePath: string) => Promise<string | null>
      fsWriteFile: (filePath: string, content: string) => Promise<boolean>
      fsCreateFile: (filePath: string) => Promise<boolean>
      fsCreateDirectory: (dirPath: string) => Promise<boolean>
      fsRename: (oldPath: string, newPath: string) => Promise<boolean>
      fsDelete: (targetPath: string) => Promise<boolean>
      fsExists: (targetPath: string) => Promise<boolean>
      // Git methods
      gitStatus: (projectPath: string) => Promise<GitStatus>
      gitChangedFiles: (projectPath: string) => Promise<GitChangedFile[]>
      gitStatusWithFiles: (projectPath: string) => Promise<{ status: GitStatus; files: GitChangedFile[] }>
      gitBranches: (projectPath: string) => Promise<GitBranch[]>
      gitLog: (projectPath: string, branch?: string, limit?: number) => Promise<GitCommit[]>
      gitCommitDetails: (projectPath: string, hash: string) => Promise<GitCommit & { files: GitDiffFile[] }>
      gitDiff: (projectPath: string, file: string, hash?: string) => Promise<string>
      gitShowFile: (projectPath: string, file: string, ref?: string) => Promise<string | null>
      gitCheckout: (projectPath: string, branch: string) => Promise<boolean>
      gitCreateBranch: (projectPath: string, branchName: string, baseBranch?: string) => Promise<boolean>
      gitDeleteBranch: (projectPath: string, branchName: string) => Promise<boolean>
      gitStage: (projectPath: string, files: string[]) => Promise<boolean>
      gitUnstage: (projectPath: string, files: string[]) => Promise<boolean>
      gitDiscard: (projectPath: string, files: string[]) => Promise<boolean>
      gitCommit: (projectPath: string, message: string) => Promise<boolean>
      gitPush: (projectPath: string) => Promise<boolean>
      gitPull: (projectPath: string) => Promise<boolean>
      // Git Watcher methods
      gitWatch: (projectPath: string) => Promise<boolean>
      gitUnwatch: (projectPath: string) => Promise<boolean>
      onGitChanged: (callback: (projectPath: string) => void) => () => void
      // Auto Sync methods
      getAutoSync: () => Promise<boolean>
      setAutoSync: (enabled: boolean) => Promise<boolean>
      onDataFileChanged: (callback: () => void) => () => void
      // Auto Save methods
      getAutoSave: () => Promise<boolean>
      setAutoSave: (enabled: boolean) => Promise<boolean>
      onAutoSaveChanged: (callback: (enabled: boolean) => void) => () => void
      // Update methods
      updateCheck: () => Promise<void>
      updateDownload: () => Promise<void>
      updateInstall: () => Promise<void>
      getAppVersion: () => Promise<string>
      onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void
      // Shell methods
      openExternal: (url: string) => Promise<void>
      // Attachment methods
      selectFiles: () => Promise<string[] | null>
      copyFileToAttachments: (taskId: string, sourcePath: string) => Promise<{ name: string; path: string; type: string; size: number } | null>
      deleteAttachment: (filePath: string) => Promise<boolean>
      openAttachment: (filePath: string) => Promise<boolean>
      getAttachmentDataUrl: (filePath: string) => Promise<string | null>
      saveAttachmentData: (taskId: string, filename: string, base64Data: string) => Promise<{ name: string; path: string; type: string; size: number } | null>
      deleteTaskAttachments: (taskId: string) => Promise<boolean>
      // Search methods
      searchFiles: (projectPath: string, query: string) => Promise<SearchFileResult[]>
      searchText: (projectPath: string, query: string) => Promise<SearchTextResult[]>
      // App Zoom methods
      getAppZoom: () => Promise<number>
      setAppZoom: (factor: number) => Promise<boolean>
      // Terminal Settings methods
      getTerminalSettings: () => Promise<{ terminalTheme?: string; terminalFontSize?: number; terminalFontFamily?: string } | null>
      saveTerminalSettings: (settings: { terminalTheme?: string; terminalFontSize?: number; terminalFontFamily?: string }) => Promise<boolean>
      onTerminalZoom: (callback: (direction: 'in' | 'out' | 'reset') => void) => () => void
      // Image / File helpers
      findClaudeImage: (imageNumber: number) => Promise<string | null>
      fsReadFileBase64: (filePath: string) => Promise<string | null>
      // Terminal State Persistence methods
      getTerminalStates: () => Promise<Record<string, { terminals: { id: string; name: string }[]; activeTerminalId: string; isSplitView: boolean }>>
      saveTerminalStates: (states: Record<string, { terminals: { id: string; name: string }[]; activeTerminalId: string; isSplitView: boolean }>) => Promise<boolean>
      deleteTerminalState: (projectId: string) => Promise<boolean>
      saveTerminalBuffer: (terminalId: string, content: string) => Promise<boolean>
      loadTerminalBuffer: (terminalId: string) => Promise<string | null>
      deleteTerminalBuffers: (projectId: string) => Promise<boolean>
    }
  }
}

export const electron = window.electronAPI
