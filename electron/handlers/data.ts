import { ipcMain, Menu } from 'electron'
import fs from 'fs'
import {
  DATA_FILE,
  getMainWindow,
  autoSyncEnabled,
  autoSaveEnabled,
  loadSettings,
  saveSettings,
  setAutoSyncEnabled,
  setAutoSaveEnabled
} from '../shared'
import {
  loadAllData,
  saveLayout as dbSaveLayout,
  setAppState as dbSetAppState,
  upsertProject as dbUpsertProject,
  deleteProject as dbDeleteProject,
  deleteTasksByProject as dbDeleteTasksByProject,
  upsertTask as dbUpsertTask,
  deleteTask as dbDeleteTask,
  batchUpsertTasks as dbBatchUpsertTasks,
  upsertLabel as dbUpsertLabel,
  deleteLabel as dbDeleteLabel,
  batchUpsertProjects as dbBatchUpsertProjects
} from '../database'

// File watcher for auto-sync (watches the old data.json for external editors, if it exists)
let fileWatcher: fs.FSWatcher | null = null
let fileWatchDebounce: NodeJS.Timeout | null = null

export function startFileWatcher() {
  if (fileWatcher) return
  if (!fs.existsSync(DATA_FILE)) return

  fileWatcher = fs.watch(DATA_FILE, (eventType) => {
    if (eventType === 'change') {
      if (fileWatchDebounce) clearTimeout(fileWatchDebounce)
      fileWatchDebounce = setTimeout(() => {
        console.log('Auto-sync: File changed externally, notifying renderer')
        getMainWindow()?.webContents.send('data-file-changed')
      }, 100)
    }
  })
}

export function stopFileWatcher() {
  if (fileWatcher) {
    fileWatcher.close()
    fileWatcher = null
  }
}

function updateAutoSyncMenu() {
  const menu = Menu.getApplicationMenu()
  if (menu) {
    const editMenu = menu.items.find(item => item.label === 'Edit')
    if (editMenu?.submenu) {
      const autoSyncItem = editMenu.submenu.items.find(item => item.label === 'Auto Sync')
      if (autoSyncItem) {
        autoSyncItem.checked = autoSyncEnabled
      }
    }
  }
}

function updateAutoSaveMenu() {
  const menu = Menu.getApplicationMenu()
  if (menu) {
    const editMenu = menu.items.find(item => item.label === 'Edit')
    if (editMenu?.submenu) {
      const autoSaveItem = editMenu.submenu.items.find(item => item.label === 'Auto Save')
      if (autoSaveItem) {
        autoSaveItem.checked = autoSaveEnabled
      }
    }
  }
}

export async function setAutoSync(enabled: boolean) {
  setAutoSyncEnabled(enabled)
  const settings = await loadSettings()
  settings.autoSync = enabled
  saveSettings(settings)

  if (enabled) {
    startFileWatcher()
  } else {
    stopFileWatcher()
  }

  updateAutoSyncMenu()
}

export async function setAutoSave(enabled: boolean) {
  setAutoSaveEnabled(enabled)
  const settings = await loadSettings()
  settings.autoSave = enabled
  saveSettings(settings)
  updateAutoSaveMenu()
  getMainWindow()?.webContents.send('auto-save-changed', enabled)
}

export function registerDataHandlers() {
  ipcMain.handle('load-data', async () => {
    return loadAllData()
  })

  // --- Targeted database operations (no full rewrite) ---

  ipcMain.handle('db-save-layout', (_event, projectId: string, layout: unknown) => {
    dbSaveLayout(projectId, layout)
    return true
  })

  ipcMain.handle('db-set-app-state', (_event, key: string, value: string | null) => {
    dbSetAppState(key, value)
    return true
  })

  ipcMain.handle('db-upsert-project', (_event, project: { id: string; name: string; path: string; order: number }) => {
    dbUpsertProject(project)
    return true
  })

  ipcMain.handle('db-delete-project', (_event, id: string) => {
    dbDeleteTasksByProject(id)
    dbDeleteProject(id)
    return true
  })

  ipcMain.handle('db-upsert-task', (_event, task: { id: string; projectId: string; title: string; description: string; column: string; labels: string[]; dueDate: string | null; createdAt: string; order: number; branch?: string; archived?: boolean; attachments?: unknown[] }) => {
    dbUpsertTask(task)
    return true
  })

  ipcMain.handle('db-delete-task', (_event, id: string) => {
    dbDeleteTask(id)
    return true
  })

  ipcMain.handle('db-batch-upsert-tasks', (_event, tasks: Array<{ id: string; projectId: string; title: string; description: string; column: string; labels: string[]; dueDate: string | null; createdAt: string; order: number; branch?: string; archived?: boolean; attachments?: unknown[] }>) => {
    dbBatchUpsertTasks(tasks)
    return true
  })

  ipcMain.handle('db-upsert-label', (_event, label: { id: string; name: string; color: string }) => {
    dbUpsertLabel(label)
    return true
  })

  ipcMain.handle('db-delete-label', (_event, id: string) => {
    dbDeleteLabel(id)
    return true
  })

  ipcMain.handle('db-batch-upsert-projects', (_event, projects: Array<{ id: string; name: string; path: string; order: number }>) => {
    dbBatchUpsertProjects(projects)
    return true
  })

  // Auto Sync
  ipcMain.handle('get-auto-sync', () => {
    return autoSyncEnabled
  })

  ipcMain.handle('set-auto-sync', (_event, enabled: boolean) => {
    setAutoSync(enabled)
    return true
  })

  // Auto Save
  ipcMain.handle('get-auto-save', () => {
    return autoSaveEnabled
  })

  ipcMain.handle('set-auto-save', (_event, enabled: boolean) => {
    setAutoSave(enabled)
    return true
  })

  // Terminal Settings
  ipcMain.handle('get-terminal-settings', async () => {
    const settings = await loadSettings()
    return {
      terminalTheme: settings.terminalTheme,
      terminalFontSize: settings.terminalFontSize,
      terminalFontFamily: settings.terminalFontFamily
    }
  })

  ipcMain.handle('save-terminal-settings', async (_event, partial: { terminalTheme?: string; terminalFontSize?: number; terminalFontFamily?: string }) => {
    const settings = await loadSettings()
    if (partial.terminalTheme !== undefined) settings.terminalTheme = partial.terminalTheme
    if (partial.terminalFontSize !== undefined) settings.terminalFontSize = partial.terminalFontSize
    if (partial.terminalFontFamily !== undefined) settings.terminalFontFamily = partial.terminalFontFamily
    saveSettings(settings)
    return true
  })

  // App Zoom
  ipcMain.handle('get-app-zoom', () => {
    return getMainWindow()?.webContents.getZoomFactor() ?? 1
  })

  ipcMain.handle('set-app-zoom', async (_event, factor: number) => {
    const win = getMainWindow()
    if (win) {
      win.webContents.setZoomFactor(factor)
      const settings = await loadSettings()
      settings.appZoomFactor = factor
      saveSettings(settings)
    }
    return true
  })

  // App version
  ipcMain.handle('get-app-version', () => {
    const { app } = require('electron')
    return app.getVersion()
  })
}
