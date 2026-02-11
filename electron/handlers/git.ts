import { ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import { simpleGit, SimpleGit, StatusResult } from 'simple-git'
import { getMainWindow } from '../shared'

// Git directory watchers with ref-counting
const gitWatchers: Map<string, fs.FSWatcher> = new Map()
const gitWatcherRefs: Map<string, number> = new Map()
const gitWatchDebounces: Map<string, NodeJS.Timeout> = new Map()

function startGitWatcher(projectPath: string) {
  if (gitWatchers.has(projectPath)) {
    const refs = gitWatcherRefs.get(projectPath) || 0
    gitWatcherRefs.set(projectPath, refs + 1)
    return
  }

  const gitDir = path.join(projectPath, '.git')
  if (!fs.existsSync(gitDir)) return

  try {
    const watcher = fs.watch(gitDir, { recursive: true }, (_eventType, filename) => {
      if (!filename) return
      if (filename.endsWith('.lock') || filename === 'COMMIT_EDITMSG') return

      const existing = gitWatchDebounces.get(projectPath)
      if (existing) clearTimeout(existing)
      gitWatchDebounces.set(projectPath, setTimeout(() => {
        gitWatchDebounces.delete(projectPath)
        getMainWindow()?.webContents.send('git-changed', projectPath)
      }, 300))
    })

    gitWatchers.set(projectPath, watcher)
    gitWatcherRefs.set(projectPath, 1)
  } catch (error) {
    console.error('Failed to watch .git directory:', error)
  }
}

function stopGitWatcher(projectPath: string) {
  const refs = (gitWatcherRefs.get(projectPath) || 1) - 1
  if (refs > 0) {
    gitWatcherRefs.set(projectPath, refs)
    return
  }

  gitWatcherRefs.delete(projectPath)
  const watcher = gitWatchers.get(projectPath)
  if (watcher) {
    watcher.close()
    gitWatchers.delete(projectPath)
  }
  const debounce = gitWatchDebounces.get(projectPath)
  if (debounce) {
    clearTimeout(debounce)
    gitWatchDebounces.delete(projectPath)
  }
}

export function stopAllGitWatchers() {
  for (const [, watcher] of gitWatchers) {
    watcher.close()
  }
  gitWatchers.clear()
  gitWatcherRefs.clear()
  for (const [, timeout] of gitWatchDebounces) {
    clearTimeout(timeout)
  }
  gitWatchDebounces.clear()
}

// Types
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

function getGit(projectPath: string): SimpleGit {
  return simpleGit({ baseDir: projectPath, timeout: { block: 10000 } })
}

export function registerGitHandlers() {
  // Watcher handlers
  ipcMain.handle('git-watch', (_event, projectPath: string) => {
    startGitWatcher(projectPath)
    return true
  })

  ipcMain.handle('git-unwatch', (_event, projectPath: string) => {
    stopGitWatcher(projectPath)
    return true
  })

  ipcMain.handle('git-status', async (_event, projectPath: string): Promise<GitStatus> => {
    try {
      const git = getGit(projectPath)
      const isRepo = await git.checkIsRepo()

      if (!isRepo) {
        return { isRepo: false, branch: '', ahead: 0, behind: 0, modified: 0, staged: 0, untracked: 0 }
      }

      const status: StatusResult = await git.status()

      let modifiedCount = 0
      let stagedCount = 0
      let untrackedCount = 0

      for (const f of status.files) {
        const idx = f.index
        const wd = f.working_dir

        if (idx === '?' && wd === '?') {
          untrackedCount++
          continue
        }

        if (idx === 'R') {
          stagedCount++
          if (wd === 'M') modifiedCount++
          continue
        }

        if (idx === 'M' || idx === 'A' || idx === 'D') {
          stagedCount++
        }

        if (wd === 'M' || wd === 'D') {
          modifiedCount++
        }
      }

      return {
        isRepo: true,
        branch: status.current || '',
        ahead: status.ahead,
        behind: status.behind,
        modified: modifiedCount,
        staged: stagedCount,
        untracked: untrackedCount
      }
    } catch (error) {
      console.error('Git status error:', error)
      return { isRepo: false, branch: '', ahead: 0, behind: 0, modified: 0, staged: 0, untracked: 0 }
    }
  })

  ipcMain.handle('git-changed-files', async (_event, projectPath: string): Promise<GitChangedFile[]> => {
    try {
      const git = getGit(projectPath)
      const isRepo = await git.checkIsRepo()
      if (!isRepo) return []

      const status: StatusResult = await git.status()
      const files: GitChangedFile[] = []

      for (const f of status.files) {
        const idx = f.index
        const wd = f.working_dir

        if (idx === '?' && wd === '?') {
          files.push({ file: f.path, status: 'untracked', staged: false })
          continue
        }

        // Detect conflicts (U in either column, or AA/DD)
        if (idx === 'U' || wd === 'U' || (idx === 'A' && wd === 'A') || (idx === 'D' && wd === 'D')) {
          files.push({ file: f.path, status: 'conflicted', staged: false })
          continue
        }

        if (idx === 'R') {
          files.push({ file: f.path, status: 'renamed', staged: true })
          if (wd === 'M') {
            files.push({ file: f.path, status: 'modified', staged: false })
          }
          continue
        }

        if (idx === 'M' || idx === 'A') {
          files.push({ file: f.path, status: 'staged', staged: true })
        } else if (idx === 'D') {
          files.push({ file: f.path, status: 'deleted', staged: true })
        }

        if (wd === 'M') {
          files.push({ file: f.path, status: 'modified', staged: false })
        } else if (wd === 'D') {
          files.push({ file: f.path, status: 'deleted', staged: false })
        }
      }

      return files
    } catch (error) {
      console.error('Git changed files error:', error)
      return []
    }
  })

  ipcMain.handle('git-status-with-files', async (_event, projectPath: string): Promise<{ status: GitStatus; files: GitChangedFile[] }> => {
    try {
      const git = getGit(projectPath)
      const isRepo = await git.checkIsRepo()

      if (!isRepo) {
        return {
          status: { isRepo: false, branch: '', ahead: 0, behind: 0, modified: 0, staged: 0, untracked: 0 },
          files: []
        }
      }

      const result: StatusResult = await git.status()

      let modifiedCount = 0
      let stagedCount = 0
      let untrackedCount = 0
      const files: GitChangedFile[] = []

      for (const f of result.files) {
        const idx = f.index
        const wd = f.working_dir

        if (idx === '?' && wd === '?') {
          untrackedCount++
          files.push({ file: f.path, status: 'untracked', staged: false })
          continue
        }

        // Detect conflicts (U in either column, or AA/DD)
        if (idx === 'U' || wd === 'U' || (idx === 'A' && wd === 'A') || (idx === 'D' && wd === 'D')) {
          files.push({ file: f.path, status: 'conflicted', staged: false })
          continue
        }

        if (idx === 'R') {
          stagedCount++
          files.push({ file: f.path, status: 'renamed', staged: true })
          if (wd === 'M') {
            modifiedCount++
            files.push({ file: f.path, status: 'modified', staged: false })
          }
          continue
        }

        if (idx === 'M' || idx === 'A') {
          stagedCount++
          files.push({ file: f.path, status: 'staged', staged: true })
        } else if (idx === 'D') {
          stagedCount++
          files.push({ file: f.path, status: 'deleted', staged: true })
        }

        if (wd === 'M') {
          modifiedCount++
          files.push({ file: f.path, status: 'modified', staged: false })
        } else if (wd === 'D') {
          modifiedCount++
          files.push({ file: f.path, status: 'deleted', staged: false })
        }
      }

      const status: GitStatus = {
        isRepo: true,
        branch: result.current || '',
        ahead: result.ahead,
        behind: result.behind,
        modified: modifiedCount,
        staged: stagedCount,
        untracked: untrackedCount
      }

      return { status, files }
    } catch (error) {
      console.error('Git status-with-files error:', error)
      return {
        status: { isRepo: false, branch: '', ahead: 0, behind: 0, modified: 0, staged: 0, untracked: 0 },
        files: []
      }
    }
  })

  ipcMain.handle('git-branches', async (_event, projectPath: string): Promise<GitBranch[]> => {
    try {
      const git = getGit(projectPath)
      const branchSummary = await git.branchLocal()
      return branchSummary.all.map((name) => ({
        name,
        current: name === branchSummary.current
      }))
    } catch (error) {
      console.error('Git branches error:', error)
      return []
    }
  })

  ipcMain.handle('git-log', async (_event, projectPath: string, branch?: string, limit = 20): Promise<GitCommit[]> => {
    try {
      const git = getGit(projectPath)
      const options = branch ? { maxCount: limit, from: branch } : { maxCount: limit }
      const log = await git.log(options)

      return log.all.map((commit) => ({
        hash: commit.hash,
        shortHash: commit.hash.substring(0, 7),
        message: commit.message,
        author: commit.author_name,
        authorEmail: commit.author_email,
        date: commit.date
      }))
    } catch (error) {
      console.error('Git log error:', error)
      return []
    }
  })

  ipcMain.handle('git-commit-details', async (_event, projectPath: string, hash: string): Promise<GitCommit & { files: GitDiffFile[] }> => {
    try {
      const git = getGit(projectPath)
      const show = await git.show([hash, '--stat', '--format=%H%n%s%n%an%n%ae%n%aI'])

      const lines = show.split('\n')
      const fullHash = lines[0]
      const message = lines[1]
      const author = lines[2]
      const authorEmail = lines[3]
      const date = lines[4]

      const files: GitDiffFile[] = []
      for (let i = 6; i < lines.length - 2; i++) {
        const line = lines[i]
        if (line.includes('|')) {
          const parts = line.split('|')
          const file = parts[0].trim()
          const stats = parts[1].trim()
          const insertions = (stats.match(/\+/g) || []).length
          const deletions = (stats.match(/-/g) || []).length
          files.push({ file, insertions, deletions, binary: stats.includes('Bin') })
        }
      }

      return { hash: fullHash, shortHash: fullHash.substring(0, 7), message, author, authorEmail, date, files }
    } catch (error) {
      console.error('Git commit details error:', error)
      throw error
    }
  })

  ipcMain.handle('git-diff', async (_event, projectPath: string, file: string, hash?: string): Promise<string> => {
    try {
      const git = getGit(projectPath)
      if (hash) {
        return await git.diff([`${hash}^`, hash, '--', file])
      }
      return await git.diff(['HEAD', '--', file])
    } catch (error) {
      console.error('Git diff error:', error)
      return ''
    }
  })

  ipcMain.handle('git-show-file', async (_event, projectPath: string, file: string, ref = 'HEAD'): Promise<string | null> => {
    try {
      const git = getGit(projectPath)
      return await git.show([`${ref}:${file}`])
    } catch (error) {
      console.error('Git show file error:', error)
      return null
    }
  })

  ipcMain.handle('git-checkout', async (_event, projectPath: string, branch: string): Promise<boolean> => {
    try {
      const git = getGit(projectPath)
      await git.checkout(branch)
      return true
    } catch (error) {
      console.error('Git checkout error:', error)
      return false
    }
  })

  ipcMain.handle('git-create-branch', async (_event, projectPath: string, branchName: string, baseBranch?: string): Promise<boolean> => {
    try {
      const git = getGit(projectPath)
      if (baseBranch) {
        await git.checkoutBranch(branchName, baseBranch)
      } else {
        await git.checkoutLocalBranch(branchName)
      }
      return true
    } catch (error) {
      console.error('Git create branch error:', error)
      return false
    }
  })

  ipcMain.handle('git-delete-branch', async (_event, projectPath: string, branchName: string): Promise<boolean> => {
    try {
      const git = getGit(projectPath)
      await git.deleteLocalBranch(branchName, true)
      return true
    } catch (error) {
      console.error('Git delete branch error:', error)
      return false
    }
  })

  ipcMain.handle('git-stage', async (_event, projectPath: string, files: string[]): Promise<boolean> => {
    try {
      if (!files || files.length === 0) return true
      const git = getGit(projectPath)
      await git.add(files)
      return true
    } catch (error) {
      console.error('Git stage error:', error)
      return false
    }
  })

  ipcMain.handle('git-unstage', async (_event, projectPath: string, files: string[]): Promise<boolean> => {
    try {
      if (!files || files.length === 0) return true
      const git = getGit(projectPath)
      await git.reset(['HEAD', '--', ...files])
      return true
    } catch (error) {
      console.error('Git unstage error:', error)
      return false
    }
  })

  ipcMain.handle('git-discard', async (_event, projectPath: string, files: string[]): Promise<boolean> => {
    try {
      if (!files || files.length === 0) return true
      const git = getGit(projectPath)
      // Separate tracked (modified/deleted) from untracked files
      const status = await git.status()
      const untrackedSet = new Set(
        status.files
          .filter(f => f.working_dir === '?' && f.index === '?')
          .map(f => f.path)
      )
      const trackedFiles = files.filter(f => !untrackedSet.has(f))
      const untrackedFiles = files.filter(f => untrackedSet.has(f))
      if (trackedFiles.length > 0) await git.checkout(['--', ...trackedFiles])
      if (untrackedFiles.length > 0) await git.raw(['clean', '-f', '--', ...untrackedFiles])
      return true
    } catch (error) {
      console.error('Git discard error:', error)
      return false
    }
  })

  ipcMain.handle('git-commit', async (_event, projectPath: string, message: string): Promise<boolean> => {
    try {
      const git = getGit(projectPath)
      await git.commit(message)
      return true
    } catch (error) {
      console.error('Git commit error:', error)
      return false
    }
  })

  ipcMain.handle('git-push', async (_event, projectPath: string): Promise<boolean> => {
    try {
      const git = getGit(projectPath)
      await git.push()
      return true
    } catch (error) {
      console.error('Git push error:', error)
      return false
    }
  })

  ipcMain.handle('git-pull', async (_event, projectPath: string): Promise<boolean> => {
    try {
      const git = getGit(projectPath)
      await git.pull()
      return true
    } catch (error) {
      console.error('Git pull error:', error)
      return false
    }
  })
}
