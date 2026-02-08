import { ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import { execFile } from 'child_process'

interface SearchFileResult {
  path: string
  name: string
  relativePath: string
}

interface SearchTextResult {
  path: string
  relativePath: string
  line: number
  content: string
}

// Try to find ripgrep binary
function findRgPath(): string | null {
  const candidates = [
    '/opt/homebrew/bin/rg',
    '/usr/local/bin/rg',
    '/usr/bin/rg'
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return null
}

const rgPath = findRgPath()

// --- Ripgrep-based search (async, non-blocking) ---

function rgSearchFiles(projectPath: string, query: string): Promise<SearchFileResult[]> {
  return new Promise((resolve) => {
    execFile(rgPath!, ['--files', '--hidden', '--glob', '!.git', '--glob', '!node_modules', '--glob', '!.next', '--glob', '!dist', '--glob', '!build', '--glob', '!.cache', '--glob', '!.turbo', '--glob', '!coverage', '--glob', '!*.lock', '--glob', '!*.log', projectPath], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
      if (error && !stdout) {
        resolve([])
        return
      }

      const lines = stdout.trim().split('\n').filter(Boolean)
      const allFiles: SearchFileResult[] = lines.map(fullPath => ({
        path: fullPath,
        name: path.basename(fullPath),
        relativePath: path.relative(projectPath, fullPath)
      }))

      // Apply fuzzy scoring
      const scored = allFiles
        .map(file => ({
          ...file,
          score: Math.max(
            fuzzyScore(query, file.name),
            fuzzyScore(query, file.relativePath) * 0.8
          )
        }))
        .filter(file => file.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 50)

      resolve(scored.map(({ path: p, name, relativePath }) => ({ path: p, name, relativePath })))
    })
  })
}

function rgSearchText(projectPath: string, query: string): Promise<SearchTextResult[]> {
  return new Promise((resolve) => {
    // --json gives structured output, --max-count limits per-file, --max-columns limits line length
    execFile(rgPath!, [
      '--json',
      '--ignore-case',
      '--max-count', '5',
      '--max-columns', '200',
      '--hidden',
      '--glob', '!.git',
      '--glob', '!node_modules',
      '--glob', '!.next',
      '--glob', '!dist',
      '--glob', '!build',
      '--glob', '!.cache',
      '--glob', '!.turbo',
      '--glob', '!coverage',
      '--glob', '!*.lock',
      '--glob', '!*.log',
      query,
      projectPath
    ], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
      if (error && !stdout) {
        resolve([])
        return
      }

      const results: SearchTextResult[] = []
      const lines = stdout.trim().split('\n').filter(Boolean)

      for (const line of lines) {
        if (results.length >= 100) break
        try {
          const parsed = JSON.parse(line)
          if (parsed.type === 'match') {
            const data = parsed.data
            results.push({
              path: data.path.text,
              relativePath: path.relative(projectPath, data.path.text),
              line: data.line_number,
              content: data.lines.text.trim().slice(0, 200)
            })
          }
        } catch {
          // Skip malformed JSON lines
        }
      }

      resolve(results)
    })
  })
}

// --- Fallback: original sync-based search (used when rg not available) ---

const IGNORE_PATTERNS = [
  'node_modules', '.git', '.next', 'dist', 'build',
  '.cache', '.turbo', 'coverage', '.DS_Store', '*.log', '*.lock'
]

function shouldIgnore(name: string): boolean {
  for (const pattern of IGNORE_PATTERNS) {
    if (pattern.startsWith('*')) {
      const ext = pattern.slice(1)
      if (name.endsWith(ext)) return true
    } else if (name === pattern) {
      return true
    }
  }
  return false
}

function getAllFilesSync(dirPath: string, basePath: string, files: SearchFileResult[] = []): SearchFileResult[] {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      if (shouldIgnore(entry.name)) continue
      const fullPath = path.join(dirPath, entry.name)
      const relativePath = path.relative(basePath, fullPath)
      if (entry.isDirectory()) {
        getAllFilesSync(fullPath, basePath, files)
      } else {
        files.push({ path: fullPath, name: entry.name, relativePath })
      }
    }
  } catch {
    // Skip directories we can't read
  }
  return files
}

function fallbackSearchFiles(projectPath: string, query: string): SearchFileResult[] {
  const allFiles = getAllFilesSync(projectPath, projectPath)
  const scored = allFiles
    .map(file => ({
      ...file,
      score: Math.max(
        fuzzyScore(query, file.name),
        fuzzyScore(query, file.relativePath) * 0.8
      )
    }))
    .filter(file => file.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 50)

  return scored.map(({ path: p, name, relativePath }) => ({ path: p, name, relativePath }))
}

function fallbackSearchText(projectPath: string, query: string): SearchTextResult[] {
  const results: SearchTextResult[] = []
  const allFiles = getAllFilesSync(projectPath, projectPath)
  const queryLower = query.toLowerCase()
  const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.tar', '.gz', '.dmg', '.exe', '.bin', '.woff', '.woff2', '.ttf', '.eot']

  for (const file of allFiles) {
    const ext = path.extname(file.name).toLowerCase()
    if (binaryExtensions.includes(ext)) continue

    try {
      const content = fs.readFileSync(file.path, 'utf-8')
      const lines = content.split('\n')
      let fileMatches = 0

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(queryLower)) {
          results.push({
            path: file.path,
            relativePath: file.relativePath,
            line: i + 1,
            content: lines[i].trim().slice(0, 200)
          })
          fileMatches++
          if (fileMatches >= 5) break
        }
      }

      if (results.length >= 100) break
    } catch {
      // Skip files we can't read
    }
  }

  return results
}

// --- Shared fuzzy scoring ---

function fuzzyScore(query: string, text: string): number {
  const queryLower = query.toLowerCase()
  const textLower = text.toLowerCase()

  if (textLower === queryLower) return 1000
  if (textLower.includes(queryLower)) {
    if (textLower.startsWith(queryLower)) return 500
    return 300
  }

  let score = 0
  let queryIdx = 0
  let prevMatchIdx = -1

  for (let i = 0; i < textLower.length && queryIdx < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIdx]) {
      if (prevMatchIdx === i - 1) {
        score += 10
      } else {
        score += 5
      }
      prevMatchIdx = i
      queryIdx++
    }
  }

  return queryIdx === queryLower.length ? score : 0
}

// --- Register handlers ---

export function registerSearchHandlers() {
  if (rgPath) {
    console.log(`Search: using ripgrep at ${rgPath}`)
  } else {
    console.log('Search: ripgrep not found, using fallback (synchronous)')
  }

  ipcMain.handle('search-files', async (_event, projectPath: string, query: string): Promise<SearchFileResult[]> => {
    try {
      if (!query.trim()) return []
      if (rgPath) {
        return await rgSearchFiles(projectPath, query)
      }
      return fallbackSearchFiles(projectPath, query)
    } catch (error) {
      console.error('Search files error:', error)
      return []
    }
  })

  ipcMain.handle('search-text', async (_event, projectPath: string, query: string): Promise<SearchTextResult[]> => {
    try {
      if (!query.trim()) return []
      if (rgPath) {
        return await rgSearchText(projectPath, query)
      }
      return fallbackSearchText(projectPath, query)
    } catch (error) {
      console.error('Search text error:', error)
      return []
    }
  })
}
