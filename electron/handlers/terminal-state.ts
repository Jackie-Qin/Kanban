import { ipcMain } from 'electron'
import fs from 'fs'
import path from 'path'
import { TERMINAL_BUFFERS_DIR, loadSettings, saveSettings, TerminalStateEntry } from '../shared'

function ensureBuffersDir() {
  if (!fs.existsSync(TERMINAL_BUFFERS_DIR)) {
    fs.mkdirSync(TERMINAL_BUFFERS_DIR, { recursive: true })
  }
}

export function registerTerminalStateHandlers() {
  ipcMain.handle('get-terminal-states', async () => {
    const settings = await loadSettings()
    return settings.terminalStates || {}
  })

  ipcMain.handle('save-terminal-states', async (_event, states: Record<string, TerminalStateEntry>) => {
    const settings = await loadSettings()
    settings.terminalStates = states
    saveSettings(settings)
    return true
  })

  ipcMain.handle('delete-terminal-state', async (_event, projectId: string) => {
    const settings = await loadSettings()
    if (settings.terminalStates) {
      delete settings.terminalStates[projectId]
      saveSettings(settings)
    }
    return true
  })

  ipcMain.handle('save-terminal-buffer', async (_event, terminalId: string, content: string) => {
    ensureBuffersDir()
    const filePath = path.join(TERMINAL_BUFFERS_DIR, `${terminalId}.txt`)
    await fs.promises.writeFile(filePath, content, 'utf-8')
    return true
  })

  ipcMain.handle('load-terminal-buffer', async (_event, terminalId: string) => {
    const filePath = path.join(TERMINAL_BUFFERS_DIR, `${terminalId}.txt`)
    try {
      return await fs.promises.readFile(filePath, 'utf-8')
    } catch {
      return null
    }
  })

  ipcMain.handle('delete-terminal-buffers', (_event, projectId: string) => {
    if (!fs.existsSync(TERMINAL_BUFFERS_DIR)) return true
    const files = fs.readdirSync(TERMINAL_BUFFERS_DIR)
    for (const file of files) {
      if (file.startsWith(projectId + '-term-')) {
        fs.unlinkSync(path.join(TERMINAL_BUFFERS_DIR, file))
      }
    }
    return true
  })
}
