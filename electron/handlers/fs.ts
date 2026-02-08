import { ipcMain, dialog, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import { getMainWindow, IMAGE_MIME_MAP } from '../shared'
import { openInITerm } from '../iterm'

interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  isHidden: boolean
  size: number
  modifiedAt: string
}

const IMAGE_CACHE_DIR = path.join(app.getPath('home'), '.claude', 'image-cache')

export function registerFsHandlers() {
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
          // Skip files we can't stat
        }
      }

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
      const stat = fs.statSync(filePath)
      if (stat.size > 5 * 1024 * 1024) {
        console.warn(`File too large to open in editor: ${filePath} (${(stat.size / 1024 / 1024).toFixed(1)}MB)`)
        return null
      }
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
      if (fs.existsSync(filePath)) return false
      fs.writeFileSync(filePath, '', 'utf-8')
      return true
    } catch (error) {
      console.error('Failed to create file:', error)
      return false
    }
  })

  ipcMain.handle('fs-create-directory', async (_event, dirPath: string): Promise<boolean> => {
    try {
      if (fs.existsSync(dirPath)) return false
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

  ipcMain.handle('fs-read-file-base64', (_event, filePath: string): string | null => {
    try {
      const buf = fs.readFileSync(filePath)
      const ext = path.extname(filePath).toLowerCase()
      const mime = IMAGE_MIME_MAP[ext] || 'application/octet-stream'
      return `data:${mime};base64,${buf.toString('base64')}`
    } catch {
      return null
    }
  })

  ipcMain.handle('find-claude-image', (_event, imageNumber: number) => {
    if (!fs.existsSync(IMAGE_CACHE_DIR)) return null
    const filename = `${imageNumber}.png`
    let bestPath: string | null = null
    let bestMtime = 0

    try {
      const dirs = fs.readdirSync(IMAGE_CACHE_DIR, { withFileTypes: true })
      for (const dir of dirs) {
        if (!dir.isDirectory()) continue
        const candidate = path.join(IMAGE_CACHE_DIR, dir.name, filename)
        if (fs.existsSync(candidate)) {
          const stat = fs.statSync(candidate)
          if (stat.mtimeMs > bestMtime) {
            bestMtime = stat.mtimeMs
            bestPath = candidate
          }
        }
      }
    } catch {
      // ignore scan errors
    }
    return bestPath
  })

  // Dialog handlers
  ipcMain.handle('select-folder', async () => {
    const win = getMainWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory']
    })
    if (result.canceled) return null
    return result.filePaths[0]
  })

  ipcMain.handle('open-external', (_event, url: string) => {
    shell.openExternal(url)
  })

  ipcMain.handle('open-iterm', (_event, projectPath: string) => {
    return openInITerm(projectPath)
  })
}
