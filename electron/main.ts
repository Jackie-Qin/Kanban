import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { loadSettings, saveSettings, setMainWindowRef, setAutoSyncEnabled, setAutoSaveEnabled } from './shared'
import { setMainWindow, killAllPty, killProjectPtys, createPty, writePty, resizePty, killPty, hasPty, reconnectPty } from './pty'
import { createMenu } from './menu'
import { checkForUpdates, registerUpdateHandlers } from './updater'
import { registerDataHandlers, startFileWatcher, stopFileWatcher } from './handlers/data'
import { registerGitHandlers, stopAllGitWatchers } from './handlers/git'
import { registerFsHandlers } from './handlers/fs'
import { registerTerminalStateHandlers } from './handlers/terminal-state'
import { registerAttachmentHandlers } from './handlers/attachments'
import { registerSearchHandlers } from './handlers/search'
import { initDatabase, closeDatabase, getAllProjects, getAppState } from './database'

let mainWindow: BrowserWindow | null = null
let isQuitting = false
let updateCheckTimeout: ReturnType<typeof setTimeout> | null = null

async function createWindow() {
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

  // Restore saved app zoom factor
  const savedSettings = await loadSettings()
  if (savedSettings.appZoomFactor && savedSettings.appZoomFactor !== 1) {
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow?.webContents.setZoomFactor(savedSettings.appZoomFactor!)
    })
  }

  // Register this window so PTY processes can send data to it
  setMainWindow(mainWindow)
  setMainWindowRef(mainWindow)

  // macOS: hide instead of close when clicking the red dot
  mainWindow.on('close', (event) => {
    if (process.platform === 'darwin' && !isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => {
    setMainWindow(null)
    setMainWindowRef(null)
    mainWindow = null
  })
}

// Initialize SQLite database (migrates from data.json on first run)
initDatabase()

// Register all IPC handlers
registerDataHandlers()
registerGitHandlers()
registerFsHandlers()
registerTerminalStateHandlers()
registerAttachmentHandlers()
registerSearchHandlers()
registerUpdateHandlers()

// PTY Handlers (kept here since pty.ts manages its own state)
ipcMain.handle('pty-create', (_event, terminalId: string, projectPath: string) => {
  const success = createPty(terminalId, projectPath)
  if (!success) console.error(`Failed to create PTY for terminal ${terminalId}`)
  return success
})

ipcMain.handle('pty-exists', (_event, terminalId: string) => {
  return hasPty(terminalId)
})

ipcMain.handle('pty-reconnect', (_event, terminalId: string) => {
  return reconnectPty(terminalId)
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

ipcMain.handle('pty-kill-project', (_event, projectId: string) => {
  killProjectPtys(projectId)
  return true
})

// App lifecycle
app.whenReady().then(async () => {
  const settings = await loadSettings()
  setAutoSyncEnabled(settings.autoSync)
  setAutoSaveEnabled(settings.autoSave ?? false)

  createMenu()
  await createWindow()

  if (settings.autoSync) {
    startFileWatcher()
  }

  // Prewarm PTY processes for all persisted terminals so tab switches are instant
  const terminalStates = settings.terminalStates || {}
  const projects = getAllProjects() as { id: string; path: string }[]
  const pathMap = new Map(projects.map(p => [p.id, p.path]))
  const closedIdsStr = getAppState('closedProjectIds')
  const closedIds = new Set<string>(closedIdsStr ? JSON.parse(closedIdsStr) : [])
  const staleProjectIds: string[] = []
  let prewarmDelay = 500
  for (const [projectId, state] of Object.entries(terminalStates)) {
    const projPath = pathMap.get(projectId)
    if (!projPath) {
      staleProjectIds.push(projectId)
      continue
    }
    if (closedIds.has(projectId)) continue
    for (const terminal of state.terminals) {
      const tid = terminal.id
      const cwd = projPath
      setTimeout(() => {
        if (!hasPty(tid)) createPty(tid, cwd)
      }, prewarmDelay)
      prewarmDelay += 200
    }
  }
  // Clean up stale terminal states for deleted projects
  if (staleProjectIds.length > 0) {
    for (const id of staleProjectIds) {
      delete terminalStates[id]
    }
    settings.terminalStates = terminalStates
    saveSettings(settings)
  }

  // Check for updates on startup (production only)
  if (!process.env.VITE_DEV_SERVER_URL) {
    updateCheckTimeout = setTimeout(() => {
      checkForUpdates()
      updateCheckTimeout = null
    }, 3000)
  }

  app.on('activate', () => {
    if (mainWindow) {
      mainWindow.show()
    } else if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    killAllPty()
    app.quit()
  }
})

app.on('before-quit', () => {
  isQuitting = true
  if (updateCheckTimeout) {
    clearTimeout(updateCheckTimeout)
    updateCheckTimeout = null
  }
  killAllPty()
  stopFileWatcher()
  stopAllGitWatchers()
  closeDatabase()
})
