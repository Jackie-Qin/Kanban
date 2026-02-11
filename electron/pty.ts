import * as pty from 'node-pty'
import { BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as os from 'os'

interface PtyProcess {
  pty: pty.IPty
  projectPath: string
}

const ptyProcesses: Map<string, PtyProcess> = new Map()

// Module-level window reference — updated when window is created/destroyed
let currentMainWindow: BrowserWindow | null = null

// Per-terminal output buffer for data produced while window is closed
const outputBuffers: Map<string, string> = new Map()
const MAX_BUFFER_SIZE = 100 * 1024 // 100KB per terminal

export function setMainWindow(win: BrowserWindow | null): void {
  currentMainWindow = win
}

export function hasPty(terminalId: string): boolean {
  return ptyProcesses.has(terminalId)
}

// Returns buffered output accumulated while the window was closed, then clears it
export function reconnectPty(terminalId: string): string | null {
  const buffered = outputBuffers.get(terminalId)
  outputBuffers.delete(terminalId)
  return buffered || null
}

export function createPty(
  terminalId: string,
  projectPath: string
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
    const ptyProcess = pty.spawn(shell, ['-l'], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: cwd,
      env: cleanEnv as { [key: string]: string }
    })

    ptyProcess.onData((data) => {
      if (currentMainWindow && !currentMainWindow.isDestroyed()) {
        currentMainWindow.webContents.send('pty-data', { terminalId, data })
      } else {
        // Buffer output when window is closed so it can be flushed on reconnect
        const existing = outputBuffers.get(terminalId) || ''
        const newBuffer = existing + data
        outputBuffers.set(
          terminalId,
          newBuffer.length > MAX_BUFFER_SIZE ? newBuffer.slice(-MAX_BUFFER_SIZE) : newBuffer
        )
      }
    })

    ptyProcess.onExit(({ exitCode }) => {
      ptyProcesses.delete(terminalId)
      outputBuffers.delete(terminalId)
      if (currentMainWindow && !currentMainWindow.isDestroyed()) {
        currentMainWindow.webContents.send('pty-exit', { terminalId, exitCode })
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
  outputBuffers.delete(terminalId)
}

export function killProjectPtys(projectId: string): void {
  for (const [terminalId, process] of ptyProcesses) {
    if (terminalId.startsWith(projectId)) {
      try {
        process.pty.kill()
      } catch (error) {
        console.error(`Failed to kill PTY ${terminalId}:`, error)
      }
      ptyProcesses.delete(terminalId)
      outputBuffers.delete(terminalId)
    }
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
  outputBuffers.clear()
}
