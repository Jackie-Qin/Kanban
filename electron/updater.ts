import { app, ipcMain, net } from 'electron'
import { getMainWindow } from './shared'

const GITHUB_RELEASES_API = 'https://api.github.com/repos/Jackie-Qin/Kanban/releases/latest'

export function checkForUpdates() {
  getMainWindow()?.webContents.send('update-status', { status: 'checking' })

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

        const isNewerVersion = (latest: string, current: string) => {
          const latestParts = latest.split('.').map(Number)
          const currentParts = current.split('.').map(Number)
          for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
            const l = latestParts[i] || 0
            const c = currentParts[i] || 0
            if (l > c) return true
            if (l < c) return false
          }
          return false
        }

        if (latestVersion && isNewerVersion(latestVersion, currentVersion)) {
          getMainWindow()?.webContents.send('update-status', {
            status: 'available',
            version: latestVersion
          })
        } else {
          getMainWindow()?.webContents.send('update-status', { status: 'not-available' })
        }
      } catch {
        getMainWindow()?.webContents.send('update-status', { status: 'not-available' })
      }
    })
  })

  request.on('error', () => {
    getMainWindow()?.webContents.send('update-status', { status: 'not-available' })
  })

  request.end()
}

export function registerUpdateHandlers() {
  ipcMain.handle('update-check', () => {
    checkForUpdates()
  })
}
