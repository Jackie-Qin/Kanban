import * as pty from 'node-pty'
import { BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as os from 'os'

interface PtyProcess {
  pty: pty.IPty
  projectPath: string
}

const ptyProcesses: Map<string, PtyProcess> = new Map()

export function createPty(
  terminalId: string,
  projectPath: string,
  mainWindow: BrowserWindow
): boolean {
  // Kill existing pty with this terminal ID if any
  killPty(terminalId)

  // Validate and resolve the working directory
  let cwd = projectPath
  if (!cwd || !fs.existsSync(cwd)) {
    cwd = os.homedir()
  }

  const shell = process.env.SHELL || '/bin/zsh'

  // Clean environment for PTY - remove npm_config_prefix which conflicts with nvm
  const cleanEnv = { ...process.env }
  delete cleanEnv.npm_config_prefix

  try {
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: cwd,
      env: cleanEnv as { [key: string]: string }
    })

    ptyProcess.onData((data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('pty-data', { terminalId, data })
      }
    })

    ptyProcess.onExit(({ exitCode }) => {
      ptyProcesses.delete(terminalId)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('pty-exit', { terminalId, exitCode })
      }
    })

    ptyProcesses.set(terminalId, { pty: ptyProcess, projectPath: cwd })
    return true
  } catch (error) {
    console.error('Failed to create PTY:', error)
    return false
  }
}

export function writePty(terminalId: string, data: string): void {
  const process = ptyProcesses.get(terminalId)
  if (process) {
    process.pty.write(data)
  }
}

export function resizePty(terminalId: string, cols: number, rows: number): void {
  const process = ptyProcesses.get(terminalId)
  if (process && cols > 0 && rows > 0) {
    try {
      process.pty.resize(cols, rows)
    } catch (error) {
      console.error('Failed to resize PTY:', error)
    }
  }
}

export function killPty(terminalId: string): void {
  const process = ptyProcesses.get(terminalId)
  if (process) {
    try {
      process.pty.kill()
    } catch (error) {
      console.error('Failed to kill PTY:', error)
    }
    ptyProcesses.delete(terminalId)
  }
}

export function killAllPty(): void {
  ptyProcesses.forEach((process, terminalId) => {
    try {
      process.pty.kill()
    } catch (error) {
      console.error(`Failed to kill PTY ${terminalId}:`, error)
    }
  })
  ptyProcesses.clear()
}
