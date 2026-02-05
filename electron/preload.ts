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
  saveData: (data: unknown) => ipcRenderer.invoke('save-data', data),
  openITerm: (projectPath: string) => ipcRenderer.invoke('open-iterm', projectPath),
  selectFolder: () => ipcRenderer.invoke('select-folder'),

  // PTY methods - using terminalId for multiple terminals
  ptyCreate: (terminalId: string, projectPath: string) =>
    ipcRenderer.invoke('pty-create', terminalId, projectPath),
  ptyWrite: (terminalId: string, data: string) =>
    ipcRenderer.invoke('pty-write', terminalId, data),
  ptyResize: (terminalId: string, cols: number, rows: number) =>
    ipcRenderer.invoke('pty-resize', terminalId, cols, rows),
  ptyKill: (terminalId: string) => ipcRenderer.invoke('pty-kill', terminalId),
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
  fsExists: (targetPath: string): Promise<boolean> =>
    ipcRenderer.invoke('fs-exists', targetPath),

  // Git methods
  gitStatus: (projectPath: string): Promise<GitStatus> =>
    ipcRenderer.invoke('git-status', projectPath),
  gitChangedFiles: (projectPath: string): Promise<GitChangedFile[]> =>
    ipcRenderer.invoke('git-changed-files', projectPath),
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

  // Search methods
  searchFiles: (projectPath: string, query: string): Promise<{ path: string; name: string; relativePath: string }[]> =>
    ipcRenderer.invoke('search-files', projectPath, query),
  searchText: (projectPath: string, query: string): Promise<{ path: string; relativePath: string; line: number; content: string }[]> =>
    ipcRenderer.invoke('search-text', projectPath, query)
})
