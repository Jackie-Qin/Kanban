import { ipcMain, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import { ATTACHMENTS_DIR, IMAGE_MIME_MAP, FILE_MIME_MAP, getMainWindow } from '../shared'

export function registerAttachmentHandlers() {
  ipcMain.handle('select-files', async (): Promise<string[] | null> => {
    const win = getMainWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections']
    })
    if (result.canceled) return null
    return result.filePaths
  })

  ipcMain.handle('copy-file-to-attachments', async (_event, taskId: string, sourcePath: string): Promise<{ name: string; path: string; type: string; size: number } | null> => {
    try {
      const taskDir = path.join(ATTACHMENTS_DIR, taskId)
      if (!fs.existsSync(taskDir)) {
        fs.mkdirSync(taskDir, { recursive: true })
      }

      let name = path.basename(sourcePath)
      let destPath = path.join(taskDir, name)

      if (fs.existsSync(destPath)) {
        const ext = path.extname(name)
        const base = path.basename(name, ext)
        let counter = 1
        while (fs.existsSync(destPath)) {
          name = `${base} (${counter})${ext}`
          destPath = path.join(taskDir, name)
          counter++
        }
      }

      fs.copyFileSync(sourcePath, destPath)
      const stat = fs.statSync(destPath)
      const ext = path.extname(name).toLowerCase()
      const type = FILE_MIME_MAP[ext] || 'application/octet-stream'

      return { name, path: destPath, type, size: stat.size }
    } catch (error) {
      console.error('Failed to copy file to attachments:', error)
      return null
    }
  })

  ipcMain.handle('delete-attachment', async (_event, filePath: string): Promise<boolean> => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
      return true
    } catch (error) {
      console.error('Failed to delete attachment:', error)
      return false
    }
  })

  ipcMain.handle('open-attachment', async (_event, filePath: string): Promise<boolean> => {
    try {
      const { shell } = require('electron')
      await shell.openPath(filePath)
      return true
    } catch (error) {
      console.error('Failed to open attachment:', error)
      return false
    }
  })

  ipcMain.handle('get-attachment-data-url', (_event, filePath: string): string | null => {
    try {
      const buf = fs.readFileSync(filePath)
      const ext = path.extname(filePath).toLowerCase()
      const mime = IMAGE_MIME_MAP[ext]
      if (!mime) return null
      return `data:${mime};base64,${buf.toString('base64')}`
    } catch {
      return null
    }
  })

  ipcMain.handle('save-attachment-data', async (_event, taskId: string, filename: string, base64Data: string): Promise<{ name: string; path: string; type: string; size: number } | null> => {
    try {
      const taskDir = path.join(ATTACHMENTS_DIR, taskId)
      if (!fs.existsSync(taskDir)) {
        fs.mkdirSync(taskDir, { recursive: true })
      }

      let name = filename
      let destPath = path.join(taskDir, name)

      if (fs.existsSync(destPath)) {
        const ext = path.extname(name)
        const base = path.basename(name, ext)
        let counter = 1
        while (fs.existsSync(destPath)) {
          name = `${base} (${counter})${ext}`
          destPath = path.join(taskDir, name)
          counter++
        }
      }

      const buffer = Buffer.from(base64Data, 'base64')
      fs.writeFileSync(destPath, buffer)
      const ext = path.extname(name).toLowerCase()
      const type = IMAGE_MIME_MAP[ext] || 'image/png'

      return { name, path: destPath, type, size: buffer.length }
    } catch (error) {
      console.error('Failed to save attachment data:', error)
      return null
    }
  })

  ipcMain.handle('delete-task-attachments', async (_event, taskId: string): Promise<boolean> => {
    try {
      const taskDir = path.join(ATTACHMENTS_DIR, taskId)
      if (fs.existsSync(taskDir)) {
        fs.rmSync(taskDir, { recursive: true })
      }
      return true
    } catch (error) {
      console.error('Failed to delete task attachments:', error)
      return false
    }
  })
}
