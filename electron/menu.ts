import { app, Menu, shell } from 'electron'
import { autoSyncEnabled, autoSaveEnabled, getMainWindow } from './shared'
import { setAutoSync, setAutoSave } from './handlers/data'
import { checkForUpdates } from './updater'

export function createMenu() {
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
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Auto Sync',
          type: 'checkbox',
          checked: autoSyncEnabled,
          accelerator: 'CmdOrCtrl+Shift+S',
          click: (menuItem) => {
            setAutoSync(menuItem.checked)
          }
        },
        {
          label: 'Auto Save',
          type: 'checkbox',
          checked: autoSaveEnabled,
          click: (menuItem) => {
            setAutoSave(menuItem.checked)
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        {
          label: 'Terminal Zoom In',
          accelerator: 'CmdOrCtrl+=',
          click: () => { getMainWindow()?.webContents.send('terminal-zoom', 'in') }
        },
        {
          label: 'Terminal Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => { getMainWindow()?.webContents.send('terminal-zoom', 'out') }
        },
        {
          label: 'Terminal Reset Zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => { getMainWindow()?.webContents.send('terminal-zoom', 'reset') }
        },
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
          click: () => { checkForUpdates() }
        },
        {
          label: 'Releases Page',
          click: () => { shell.openExternal('https://github.com/Jackie-Qin/Kanban/releases/latest') }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}
