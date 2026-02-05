import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
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

function setupAutoUpdater() {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  // Allow updates without code signing (for personal/unsigned apps)
  autoUpdater.forceDevUpdateConfig = true

  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('update-status', { status: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update-status', {
      status: 'available',
      version: info.version,
      releaseNotes: info.releaseNotes
    })
  })

  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('update-status', { status: 'not-available' })
  })

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update-status', {
      status: 'downloading',
      percent: progress.percent
    })
  })

  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send('update-status', { status: 'downloaded' })
  })

  autoUpdater.on('error', (error) => {
    mainWindow?.webContents.send('update-status', {
      status: 'error',
      message: error.message
    })
  })
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
            autoUpdater.checkForUpdates()
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
  setupAutoUpdater()

  // Check for updates on startup (production only)
  if (!process.env.VITE_DEV_SERVER_URL) {
    setTimeout(() => {
      autoUpdater.checkForUpdates()
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
  autoUpdater.checkForUpdates()
})

ipcMain.handle('update-download', () => {
  autoUpdater.downloadUpdate()
})

ipcMain.handle('update-install', () => {
  autoUpdater.quitAndInstall()
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
    await git.deleteLocalBranch(branchName)
    return true
  } catch (error) {
    console.error('Git delete branch error:', error)
    return false
  }
})
