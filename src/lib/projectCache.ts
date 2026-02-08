import { electron, GitStatus, GitBranch, GitCommit, GitChangedFile, FileEntry } from './electron'

// --- Git cache ---

export interface GitCacheEntry {
  status: GitStatus
  changedFiles: GitChangedFile[]
  branches: GitBranch[]
  commits: GitCommit[]
  timestamp: number
}

export const gitCache = new Map<string, GitCacheEntry>()

export async function prefetchGitData(projectPath: string): Promise<void> {
  try {
    const [statusWithFiles, branches, commits] = await Promise.all([
      electron.gitStatusWithFiles(projectPath),
      electron.gitBranches(projectPath),
      electron.gitLog(projectPath, undefined, 20)
    ])
    gitCache.set(projectPath, {
      status: statusWithFiles.status,
      changedFiles: statusWithFiles.files,
      branches,
      commits,
      timestamp: Date.now()
    })
  } catch {
    // Silently ignore — project may not be a git repo
  }
}

// --- Directory cache ---

interface TreeNode extends FileEntry {
  children?: TreeNode[]
  isExpanded?: boolean
  isLoading?: boolean
}

export const dirCache = new Map<string, TreeNode[]>()

export async function prefetchDirData(projectPath: string): Promise<void> {
  try {
    const entries = await electron.fsReadDirectory(projectPath)
    const nodes: TreeNode[] = entries.map((entry) => ({
      ...entry,
      isExpanded: false,
      children: undefined
    }))
    dirCache.set(projectPath, nodes)
  } catch {
    // Silently ignore
  }
}
