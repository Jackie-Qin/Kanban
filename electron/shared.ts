import { app, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'

// Paths
export const DATA_DIR = path.join(app.getPath('home'), '.kanban')
export const DATA_FILE = path.join(DATA_DIR, 'data.json')
export const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json')
export const ATTACHMENTS_DIR = path.join(DATA_DIR, 'attachments')
export const TERMINAL_BUFFERS_DIR = path.join(DATA_DIR, 'terminal-buffers')

// Shared MIME type maps
export const IMAGE_MIME_MAP: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp', '.ico': 'image/x-icon'
}

export const FILE_MIME_MAP: Record<string, string> = {
  ...IMAGE_MIME_MAP,
  '.pdf': 'application/pdf', '.txt': 'text/plain',
  '.md': 'text/markdown', '.json': 'application/json',
  '.zip': 'application/zip'
}

// Mutable shared state
let mainWindow: BrowserWindow | null = null
export let autoSyncEnabled = false
export let autoSaveEnabled = false
export let lastSaveTime = 0

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

export function setMainWindowRef(win: BrowserWindow | null) {
  mainWindow = win
}

export function setAutoSyncEnabled(enabled: boolean) {
  autoSyncEnabled = enabled
}

export function setAutoSaveEnabled(enabled: boolean) {
  autoSaveEnabled = enabled
}

export function setLastSaveTime(time: number) {
  lastSaveTime = time
}

// Settings types
export interface TerminalStateEntry {
  terminals: { id: string; name: string }[]
  activeTerminalId: string
  isSplitView: boolean
}

export interface AppSettings {
  autoSync: boolean
  autoSave?: boolean
  terminalTheme?: string
  terminalFontSize?: number
  terminalFontFamily?: string
  appZoomFactor?: number
  terminalStates?: Record<string, TerminalStateEntry>
  hotkeyOverrides?: Record<string, { key: string; meta?: boolean; shift?: boolean; alt?: boolean; ctrl?: boolean }>
}

// Settings helpers
export function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

export async function loadSettings(): Promise<AppSettings> {
  ensureDataDir()
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      const content = await fs.promises.readFile(SETTINGS_FILE, 'utf-8')
      return JSON.parse(content)
    } catch {
      return { autoSync: false }
    }
  }
  return { autoSync: false }
}

export function saveSettings(settings: AppSettings) {
  ensureDataDir()
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2))
}
