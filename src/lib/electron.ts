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

export interface UpdateStatus {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  version?: string
  releaseNotes?: string
  percent?: number
  message?: string
}

declare global {
  interface Window {
    electronAPI: {
      loadData: () => Promise<AppData>
      saveData: (data: AppData) => Promise<boolean>
      openITerm: (projectPath: string) => Promise<boolean>
      selectFolder: () => Promise<string | null>
      // PTY methods - using terminalId for multiple terminals
      ptyCreate: (terminalId: string, projectPath: string) => Promise<boolean>
      ptyWrite: (terminalId: string, data: string) => Promise<boolean>
      ptyResize: (terminalId: string, cols: number, rows: number) => Promise<boolean>
      ptyKill: (terminalId: string) => Promise<boolean>
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
      gitBranches: (projectPath: string) => Promise<GitBranch[]>
      gitLog: (projectPath: string, branch?: string, limit?: number) => Promise<GitCommit[]>
      gitCommitDetails: (projectPath: string, hash: string) => Promise<GitCommit & { files: GitDiffFile[] }>
      gitDiff: (projectPath: string, file: string, hash?: string) => Promise<string>
      gitCheckout: (projectPath: string, branch: string) => Promise<boolean>
      gitCreateBranch: (projectPath: string, branchName: string, baseBranch?: string) => Promise<boolean>
      gitDeleteBranch: (projectPath: string, branchName: string) => Promise<boolean>
      // Update methods
      updateCheck: () => Promise<void>
      updateDownload: () => Promise<void>
      updateInstall: () => Promise<void>
      getAppVersion: () => Promise<string>
      onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void
      // Shell methods
      openExternal: (url: string) => Promise<void>
    }
  }
}

export const electron = window.electronAPI
