import { app, BrowserWindow, ipcMain, dialog, Menu, shell, net } from 'electron'
import path from 'path'
import fs from 'fs'
import { simpleGit, SimpleGit, StatusResult } from 'simple-git'
import { openInITerm } from './iterm'
import { createPty, writePty, resizePty, killPty, killAllPty } from './pty'

const DATA_DIR = path.join(app.getPath('home'), '.kanban')
const DATA_FILE = path.join(DATA_DIR, 'data.json')

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

function getDefaultData() {
  return {
    projects: [],
    tasks: [],
    labels: [
      { id: 'bug', name: 'Bug', color: '#ef4444' },
      { id: 'feature', name: 'Feature', color: '#22c55e' },
      { id: 'urgent', name: 'Urgent', color: '#f97316' },
      { id: 'improvement', name: 'Improvement', color: '#3b82f6' }
    ],
    activeProjectId: null
  }
}

function loadData() {
  ensureDataDir()
  if (fs.existsSync(DATA_FILE)) {
    const content = fs.readFileSync(DATA_FILE, 'utf-8')
    return JSON.parse(content)
  }
  return getDefaultData()
}

function saveData(data: unknown) {
  ensureDataDir()
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2))
}

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

const GITHUB_RELEASES_API = 'https://api.github.com/repos/Jackie-Qin/Kanban/releases/latest'

function checkForUpdates() {
  mainWindow?.webContents.send('update-status', { status: 'checking' })

  const request = net.request(GITHUB_RELEASES_API)
  request.setHeader('Accept', 'application/vnd.github.v3+json')
  request.setHeader('User-Agent', 'Kanban-App')

  let data = ''

  request.on('response', (response) => {
    response.on('data', (chunk) => {
      data += chunk.toString()
    })

    response.on('end', () => {
      try {
        const release = JSON.parse(data)
        const latestVersion = release.tag_name?.replace('v', '') || ''
        const currentVersion = app.getVersion()

        if (latestVersion && latestVersion !== currentVersion) {
          mainWindow?.webContents.send('update-status', {
            status: 'available',
            version: latestVersion
          })
        } else {
          mainWindow?.webContents.send('update-status', { status: 'not-available' })
        }
      } catch {
        mainWindow?.webContents.send('update-status', { status: 'not-available' })
      }
    })
  })

  request.on('error', () => {
    mainWindow?.webContents.send('update-status', { status: 'not-available' })
  })

  request.end()
}

function createMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates...',
          click: () => {
            checkForUpdates()
          }
        },
        {
          label: 'Releases Page',
          click: () => {
            shell.openExternal('https://github.com/Jackie-Qin/Kanban/releases/latest')
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

app.whenReady().then(() => {
  createMenu()
  createWindow()

  // Check for updates on startup (production only)
  if (!process.env.VITE_DEV_SERVER_URL) {
    setTimeout(() => {
      checkForUpdates()
    }, 3000)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  killAllPty()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  killAllPty()
})

// IPC Handlers
ipcMain.handle('load-data', () => {
  return loadData()
})

ipcMain.handle('save-data', (_event, data) => {
  saveData(data)
  return true
})

// Update Handlers
ipcMain.handle('update-check', () => {
  checkForUpdates()
})

ipcMain.handle('get-app-version', () => {
  return app.getVersion()
})

ipcMain.handle('open-external', (_event, url: string) => {
  shell.openExternal(url)
})

ipcMain.handle('open-iterm', (_event, projectPath: string) => {
  return openInITerm(projectPath)
})

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory']
  })
  if (result.canceled) {
    return null
  }
  return result.filePaths[0]
})

// PTY Handlers
ipcMain.handle('pty-create', (_event, terminalId: string, projectPath: string) => {
  if (mainWindow) {
    const success = createPty(terminalId, projectPath, mainWindow)
    if (!success) {
      console.error(`Failed to create PTY for terminal ${terminalId}`)
    }
    return success
  }
  return false
})

ipcMain.handle('pty-write', (_event, terminalId: string, data: string) => {
  writePty(terminalId, data)
  return true
})

ipcMain.handle('pty-resize', (_event, terminalId: string, cols: number, rows: number) => {
  resizePty(terminalId, cols, rows)
  return true
})

ipcMain.handle('pty-kill', (_event, terminalId: string) => {
  killPty(terminalId)
  return true
})

// File System Handlers
interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  isHidden: boolean
  size: number
  modifiedAt: string
}

ipcMain.handle('fs-read-directory', async (_event, dirPath: string): Promise<FileEntry[]> => {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    const result: FileEntry[] = []

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      try {
        const stat = fs.statSync(fullPath)
        result.push({
          name: entry.name,
          path: fullPath,
          isDirectory: entry.isDirectory(),
          isHidden: entry.name.startsWith('.'),
          size: stat.size,
          modifiedAt: stat.mtime.toISOString()
        })
      } catch {
        // Skip files we can't stat (permission issues, etc.)
      }
    }

    // Sort: directories first, then files, both alphabetically
    return result.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })
  } catch (error) {
    console.error('Failed to read directory:', error)
    return []
  }
})

ipcMain.handle('fs-read-file', async (_event, filePath: string): Promise<string | null> => {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch (error) {
    console.error('Failed to read file:', error)
    return null
  }
})

ipcMain.handle('fs-write-file', async (_event, filePath: string, content: string): Promise<boolean> => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8')
    return true
  } catch (error) {
    console.error('Failed to write file:', error)
    return false
  }
})

ipcMain.handle('fs-create-file', async (_event, filePath: string): Promise<boolean> => {
  try {
    if (fs.existsSync(filePath)) {
      return false // File already exists
    }
    fs.writeFileSync(filePath, '', 'utf-8')
    return true
  } catch (error) {
    console.error('Failed to create file:', error)
    return false
  }
})

ipcMain.handle('fs-create-directory', async (_event, dirPath: string): Promise<boolean> => {
  try {
    if (fs.existsSync(dirPath)) {
      return false // Directory already exists
    }
    fs.mkdirSync(dirPath, { recursive: true })
    return true
  } catch (error) {
    console.error('Failed to create directory:', error)
    return false
  }
})

ipcMain.handle('fs-rename', async (_event, oldPath: string, newPath: string): Promise<boolean> => {
  try {
    fs.renameSync(oldPath, newPath)
    return true
  } catch (error) {
    console.error('Failed to rename:', error)
    return false
  }
})

ipcMain.handle('fs-delete', async (_event, targetPath: string): Promise<boolean> => {
  try {
    const stat = fs.statSync(targetPath)
    if (stat.isDirectory()) {
      fs.rmSync(targetPath, { recursive: true })
    } else {
      fs.unlinkSync(targetPath)
    }
    return true
  } catch (error) {
    console.error('Failed to delete:', error)
    return false
  }
})

ipcMain.handle('fs-exists', async (_event, targetPath: string): Promise<boolean> => {
  return fs.existsSync(targetPath)
})

// Git Handlers
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

function getGit(projectPath: string): SimpleGit {
  return simpleGit(projectPath)
}

ipcMain.handle('git-status', async (_event, projectPath: string): Promise<GitStatus> => {
  try {
    const git = getGit(projectPath)
    const isRepo = await git.checkIsRepo()

    if (!isRepo) {
      return {
        isRepo: false,
        branch: '',
        ahead: 0,
        behind: 0,
        modified: 0,
        staged: 0,
        untracked: 0
      }
    }

    const status: StatusResult = await git.status()

    return {
      isRepo: true,
      branch: status.current || '',
      ahead: status.ahead,
      behind: status.behind,
      modified: status.modified.length + status.deleted.length,
      staged: status.staged.length,
      untracked: status.not_added.length
    }
  } catch (error) {
    console.error('Git status error:', error)
    return {
      isRepo: false,
      branch: '',
      ahead: 0,
      behind: 0,
      modified: 0,
      staged: 0,
      untracked: 0
    }
  }
})

ipcMain.handle('git-changed-files', async (_event, projectPath: string): Promise<GitChangedFile[]> => {
  try {
    const git = getGit(projectPath)
    const isRepo = await git.checkIsRepo()

    if (!isRepo) {
      return []
    }

    const status: StatusResult = await git.status()
    const files: GitChangedFile[] = []

    // Staged files
    for (const file of status.staged) {
      files.push({ file, status: 'staged', staged: true })
    }

    // Modified files (unstaged)
    for (const file of status.modified) {
      // Skip if already in staged
      if (!files.some(f => f.file === file)) {
        files.push({ file, status: 'modified', staged: false })
      }
    }

    // Deleted files
    for (const file of status.deleted) {
      if (!files.some(f => f.file === file)) {
        files.push({ file, status: 'deleted', staged: false })
      }
    }

    // Untracked files
    for (const file of status.not_added) {
      files.push({ file, status: 'untracked', staged: false })
    }

    // Renamed files
    for (const rename of status.renamed) {
      files.push({ file: `${rename.from} → ${rename.to}`, status: 'renamed', staged: true })
    }

    // Conflicted files
    for (const file of status.conflicted) {
      files.push({ file, status: 'conflicted', staged: false })
    }

    return files
  } catch (error) {
    console.error('Git changed files error:', error)
    return []
  }
})

ipcMain.handle('git-branches', async (_event, projectPath: string): Promise<GitBranch[]> => {
  try {
    const git = getGit(projectPath)

    // Prune stale remote-tracking branches before listing
    try {
      await git.fetch(['--prune'])
    } catch {
      // Ignore prune errors (might not have remote)
    }

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
    const show = await git.show([hash, '--stat', '--format=%H%n%s%n%an%n%aI'])

    // Parse the output
    const lines = show.split('\n')
    const fullHash = lines[0]
    const message = lines[1]
    const author = lines[2]
    const date = lines[3]

    // Parse file stats
    const files: GitDiffFile[] = []
    for (let i = 5; i < lines.length - 2; i++) {
      const line = lines[i]
      if (line.includes('|')) {
        const parts = line.split('|')
        const file = parts[0].trim()
        const stats = parts[1].trim()
        const insertions = (stats.match(/\+/g) || []).length
        const deletions = (stats.match(/-/g) || []).length
        files.push({
          file,
          insertions,
          deletions,
          binary: stats.includes('Bin')
        })
      }
    }

    return {
      hash: fullHash,
      shortHash: fullHash.substring(0, 7),
      message,
      author,
      date,
      files
    }
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
    const content = await git.show([`${ref}:${file}`])
    return content
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
    // Use force delete to handle unmerged branches
    await git.deleteLocalBranch(branchName, true)
    return true
  } catch (error) {
    console.error('Git delete branch error:', error)
    return false
  }
})

// Search Handlers
interface SearchFileResult {
  path: string
  name: string
  relativePath: string
}

interface SearchTextResult {
  path: string
  relativePath: string
  line: number
  content: string
}

// Directories and files to ignore during search
const IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  '.cache',
  '.turbo',
  'coverage',
  '.DS_Store',
  '*.log',
  '*.lock'
]

function shouldIgnore(name: string): boolean {
  for (const pattern of IGNORE_PATTERNS) {
    if (pattern.startsWith('*')) {
      // Wildcard pattern (e.g., *.log)
      const ext = pattern.slice(1)
      if (name.endsWith(ext)) return true
    } else if (name === pattern) {
      return true
    }
  }
  return false
}

// Recursively get all files in a directory
async function getAllFiles(dirPath: string, basePath: string, files: SearchFileResult[] = []): Promise<SearchFileResult[]> {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      if (shouldIgnore(entry.name)) continue

      const fullPath = path.join(dirPath, entry.name)
      const relativePath = path.relative(basePath, fullPath)

      if (entry.isDirectory()) {
        await getAllFiles(fullPath, basePath, files)
      } else {
        files.push({
          path: fullPath,
          name: entry.name,
          relativePath
        })
      }
    }
  } catch {
    // Skip directories we can't read
  }

  return files
}

// Simple fuzzy match scoring
function fuzzyScore(query: string, text: string): number {
  const queryLower = query.toLowerCase()
  const textLower = text.toLowerCase()

  // Exact match gets highest score
  if (textLower === queryLower) return 1000

  // Contains query as substring
  if (textLower.includes(queryLower)) {
    // Bonus for match at start
    if (textLower.startsWith(queryLower)) return 500
    return 300
  }

  // Character-by-character fuzzy match
  let score = 0
  let queryIdx = 0
  let prevMatchIdx = -1

  for (let i = 0; i < textLower.length && queryIdx < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIdx]) {
      // Consecutive matches get bonus
      if (prevMatchIdx === i - 1) {
        score += 10
      } else {
        score += 5
      }
      prevMatchIdx = i
      queryIdx++
    }
  }

  // Only return score if all query characters were matched
  return queryIdx === queryLower.length ? score : 0
}

ipcMain.handle('search-files', async (_event, projectPath: string, query: string): Promise<SearchFileResult[]> => {
  try {
    if (!query.trim()) return []

    const allFiles = await getAllFiles(projectPath, projectPath)

    // Score and filter files
    const scored = allFiles
      .map(file => ({
        ...file,
        score: Math.max(
          fuzzyScore(query, file.name),
          fuzzyScore(query, file.relativePath) * 0.8 // Path match weighted slightly lower
        )
      }))
      .filter(file => file.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50) // Limit results

    return scored.map(({ path: p, name, relativePath }) => ({ path: p, name, relativePath }))
  } catch (error) {
    console.error('Search files error:', error)
    return []
  }
})

ipcMain.handle('search-text', async (_event, projectPath: string, query: string): Promise<SearchTextResult[]> => {
  try {
    if (!query.trim()) return []

    const results: SearchTextResult[] = []
    const allFiles = await getAllFiles(projectPath, projectPath)
    const queryLower = query.toLowerCase()

    // Binary file extensions to skip
    const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.tar', '.gz', '.dmg', '.exe', '.bin', '.woff', '.woff2', '.ttf', '.eot']

    for (const file of allFiles) {
      // Skip binary files
      const ext = path.extname(file.name).toLowerCase()
      if (binaryExtensions.includes(ext)) continue

      try {
        const content = fs.readFileSync(file.path, 'utf-8')
        const lines = content.split('\n')

        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(queryLower)) {
            results.push({
              path: file.path,
              relativePath: file.relativePath,
              line: i + 1,
              content: lines[i].trim().slice(0, 200) // Limit line length
            })

            // Limit results per file
            if (results.filter(r => r.path === file.path).length >= 5) break
          }
        }

        // Limit total results
        if (results.length >= 100) break
      } catch {
        // Skip files we can't read
      }
    }

    return results
  } catch (error) {
    console.error('Search text error:', error)
    return []
  }
})
