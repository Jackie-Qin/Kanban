import { useState, useCallback, useEffect, useRef } from 'react'
import { IDockviewPanelProps } from 'dockview'
import Editor, { DiffEditor, OnMount } from '@monaco-editor/react'
import { electron } from '../../lib/electron'
import { eventBus } from '../../lib/eventBus'
import FileIcon from '../FileIcon'

interface EditorPanelParams {
  projectId: string
  projectPath: string
}

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'])

function isImageFile(filename: string): boolean {
  const ext = '.' + (filename.split('.').pop()?.toLowerCase() || '')
  return IMAGE_EXTENSIONS.has(ext)
}

interface OpenFile {
  path: string
  name: string
  content: string
  originalContent: string
  isPreview: boolean
  isModified: boolean
  showDiff: boolean
  isImage?: boolean
  imageDataUrl?: string
  gitOriginal?: string // Content from git HEAD for diff view
}

// Get language from file extension
function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'ts':
      return 'typescript'
    case 'tsx':
      return 'typescript'
    case 'js':
      return 'javascript'
    case 'jsx':
      return 'javascript'
    case 'json':
      return 'json'
    case 'html':
      return 'html'
    case 'css':
      return 'css'
    case 'scss':
      return 'scss'
    case 'sass':
      return 'sass'
    case 'less':
      return 'less'
    case 'md':
      return 'markdown'
    case 'py':
      return 'python'
    case 'go':
      return 'go'
    case 'rs':
      return 'rust'
    case 'java':
      return 'java'
    case 'swift':
      return 'swift'
    case 'kt':
    case 'kts':
      return 'kotlin'
    case 'c':
      return 'c'
    case 'cpp':
    case 'cc':
    case 'cxx':
      return 'cpp'
    case 'h':
    case 'hpp':
      return 'cpp'
    case 'm':
    case 'mm':
      return 'objective-c'
    case 'sh':
    case 'bash':
    case 'zsh':
      return 'shell'
    case 'yml':
    case 'yaml':
      return 'yaml'
    case 'xml':
    case 'plist':
      return 'xml'
    case 'sql':
      return 'sql'
    case 'graphql':
    case 'gql':
      return 'graphql'
    case 'rb':
      return 'ruby'
    case 'php':
      return 'php'
    case 'r':
      return 'r'
    case 'lua':
      return 'lua'
    case 'dart':
      return 'dart'
    case 'dockerfile':
      return 'dockerfile'
    default:
      // Check filename for special files
      const lowerName = filename.toLowerCase()
      if (lowerName === 'dockerfile') return 'dockerfile'
      if (lowerName === 'makefile') return 'makefile'
      if (lowerName.endsWith('.podspec')) return 'ruby'
      return 'plaintext'
  }
}

export default function EditorPanel(props: IDockviewPanelProps<EditorPanelParams>) {
  const projectId = props.params.projectId
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([])
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null)
  const [diffViewMode, setDiffViewMode] = useState<'inline' | 'split'>('split')
  const [autoSave, setAutoSave] = useState(false)
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Load persisted auto-save setting from Electron
  useEffect(() => {
    electron.getAutoSave().then(setAutoSave)
    const unsubscribe = electron.onAutoSaveChanged(setAutoSave)
    return () => unsubscribe()
  }, [])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const diffEditorRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const monacoRef = useRef<any>(null)
  const saveFileRef = useRef<() => void>(() => {})
  const openFilesRef = useRef(openFiles)
  openFilesRef.current = openFiles
  const editorAreaRef = useRef<HTMLDivElement>(null)
  const [editorAreaHeight, setEditorAreaHeight] = useState(0)

  // Measure the editor area container in pixels (avoids CSS percentage height issues)
  useEffect(() => {
    const el = editorAreaRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const h = Math.floor(entries[0]?.contentRect.height ?? 0)
      setEditorAreaHeight((prev) => prev === h ? prev : h)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Per-project editor state cache
  const projectStateCache = useRef<Map<string, { openFiles: OpenFile[]; activeFilePath: string | null }>>(new Map())
  const prevProjectId = useRef<string>(projectId)

  // Save/restore editor state when switching projects
  useEffect(() => {
    if (prevProjectId.current !== projectId) {
      // Save outgoing project state
      projectStateCache.current.set(prevProjectId.current, {
        openFiles,
        activeFilePath
      })

      // Restore incoming project state (or empty)
      const cached = projectStateCache.current.get(projectId)
      if (cached) {
        setOpenFiles(cached.openFiles)
        setActiveFilePath(cached.activeFilePath)
      } else {
        setOpenFiles([])
        setActiveFilePath(null)
      }

      prevProjectId.current = projectId
    }
  }, [projectId])

  const activeFile = openFiles.find((f) => f.path === activeFilePath)

  // Jump to a specific line in the editor
  const jumpToLine = useCallback((lineNumber: number) => {
    if (editorRef.current && monacoRef.current) {
      setTimeout(() => {
        editorRef.current.revealLineInCenter(lineNumber)
        editorRef.current.setPosition({ lineNumber, column: 1 })
        editorRef.current.focus()
      }, 100)
    }
  }, [])

  const openFile = useCallback(
    async (filePath: string, isPreview: boolean, showDiff = false, gitProjectPath?: string, gitRelativePath?: string, lineNumber?: number) => {
      // Check if file is already open (read from ref to avoid stale closure)
      const currentFiles = openFilesRef.current
      const existingIndex = currentFiles.findIndex((f) => f.path === filePath)
      if (existingIndex !== -1) {
        const existingFile = currentFiles[existingIndex]

        // Fetch gitOriginal BEFORE state updates to avoid two-phase render
        let newGitOriginal = existingFile.gitOriginal
        if (showDiff && !existingFile.gitOriginal && gitProjectPath && gitRelativePath) {
          newGitOriginal = (await electron.gitShowFile(gitProjectPath, gitRelativePath)) ?? ''
        }

        // Batch state updates (no await between them)
        setActiveFilePath(filePath)
        setOpenFiles((prev) =>
          prev.map((f) => (f.path === filePath ? { ...f, isPreview: isPreview ? f.isPreview : false, showDiff, ...(newGitOriginal !== undefined ? { gitOriginal: newGitOriginal } : {}) } : f))
        )

        if (lineNumber) {
          jumpToLine(lineNumber)
        }
        return
      }

      const name = filePath.split('/').pop() || filePath

      // Handle image files
      if (isImageFile(name)) {
        const dataUrl = await electron.fsReadFileBase64(filePath)
        if (!dataUrl) {
          console.error('Failed to read image:', filePath)
          return
        }
        const newFile: OpenFile = {
          path: filePath,
          name,
          content: '',
          originalContent: '',
          isPreview,
          isModified: false,
          showDiff: false,
          isImage: true,
          imageDataUrl: dataUrl
        }
        setOpenFiles((prev) => {
          if (isPreview) {
            const previewIndex = prev.findIndex((f) => f.isPreview)
            if (previewIndex !== -1) {
              const newFiles = [...prev]
              newFiles[previewIndex] = newFile
              return newFiles
            }
          }
          return [...prev, newFile]
        })
        setActiveFilePath(filePath)
        return
      }

      // Load file content
      const content = await electron.fsReadFile(filePath)
      if (content === null) {
        console.error('Failed to read file:', filePath)
        return
      }

      // If showing diff, get the original from git HEAD
      let gitOriginal: string | undefined
      if (showDiff && gitProjectPath && gitRelativePath) {
        try {
          // Get the file content from HEAD
          const result = await electron.gitShowFile(gitProjectPath, gitRelativePath)
          gitOriginal = result ?? '' // New/untracked files show as entirely added
        } catch (e) {
          console.error('Failed to get git original:', e)
          gitOriginal = ''
        }
      }

      const newFile: OpenFile = {
        path: filePath,
        name,
        content,
        originalContent: content,
        isPreview,
        isModified: false,
        showDiff,
        gitOriginal
      }

      setOpenFiles((prev) => {
        // If opening in preview mode, replace existing preview tab
        if (isPreview) {
          const previewIndex = prev.findIndex((f) => f.isPreview)
          if (previewIndex !== -1) {
            const newFiles = [...prev]
            newFiles[previewIndex] = newFile
            return newFiles
          }
        }
        return [...prev, newFile]
      })
      setActiveFilePath(filePath)

      // Jump to line if specified
      if (lineNumber) {
        jumpToLine(lineNumber)
      }
    },
    [jumpToLine]
  )

  // Keep a ref to the latest openFile so the event listener is never stale
  const openFileRef = useRef(openFile)
  useEffect(() => { openFileRef.current = openFile }, [openFile])

  // Listen for file open requests from Directory panel and Search modal
  useEffect(() => {
    return eventBus.on('editor:open-file', (detail) => {
      const { path, filePath, preview = false, showDiff, projectPath, relativePath, line } = detail
      const targetPath = path || filePath
      if (targetPath) {
        openFileRef.current(targetPath, preview, showDiff, projectPath, relativePath, line)
      }
    })
  }, [])

  const closeFile = useCallback(
    (filePath: string) => {
      const fileIndex = openFiles.findIndex((f) => f.path === filePath)
      if (fileIndex === -1) return

      const file = openFiles[fileIndex]
      if (file.isModified) {
        const save = window.confirm(`Save changes to ${file.name}?`)
        if (save) {
          electron.fsWriteFile(filePath, file.content)
        }
      }

      setOpenFiles((prev) => prev.filter((f) => f.path !== filePath))

      // If closing active file, switch to another
      if (activeFilePath === filePath) {
        const remaining = openFiles.filter((f) => f.path !== filePath)
        if (remaining.length > 0) {
          const newActiveIndex = Math.min(fileIndex, remaining.length - 1)
          setActiveFilePath(remaining[newActiveIndex].path)
        } else {
          setActiveFilePath(null)
        }
      }
    },
    [openFiles, activeFilePath]
  )

  const saveFile = useCallback(async () => {
    if (!activeFile) return

    const success = await electron.fsWriteFile(activeFile.path, activeFile.content)
    if (success) {
      setOpenFiles((prev) =>
        prev.map((f) =>
          f.path === activeFile.path
            ? { ...f, originalContent: f.content, isModified: false }
            : f
        )
      )
    }
  }, [activeFile])
  saveFileRef.current = saveFile

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (!activeFilePath || value === undefined) return

      setOpenFiles((prev) =>
        prev.map((f) =>
          f.path === activeFilePath
            ? {
                ...f,
                content: value,
                isModified: value !== f.originalContent,
                isPreview: false // Convert to permanent tab on edit
              }
            : f
        )
      )
    },
    [activeFilePath]
  )

  // Auto-save: debounce save after content changes
  useEffect(() => {
    if (!autoSave) return
    const modifiedFile = openFiles.find(f => f.path === activeFilePath && f.isModified && !f.isImage)
    if (!modifiedFile) return

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(async () => {
      const success = await electron.fsWriteFile(modifiedFile.path, modifiedFile.content)
      if (success) {
        setOpenFiles(prev =>
          prev.map(f =>
            f.path === modifiedFile.path
              ? { ...f, originalContent: f.content, isModified: false }
              : f
          )
        )
      }
    }, 1000)

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [autoSave, openFiles, activeFilePath])

  // Track editor mount state so the ResizeObserver effect re-runs after onMount
  const [editorMounted, setEditorMounted] = useState(0)

  // Debounced resize for Monaco editor (replaces automaticLayout which resizes every frame)
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    let container: HTMLElement | null | undefined
    try { container = editor.getDomNode()?.parentElement } catch { return }
    if (!container) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const ro = new ResizeObserver(() => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => editor.layout(), 150)
    })
    ro.observe(container)
    return () => {
      if (timer) clearTimeout(timer)
      ro.disconnect()
    }
  }, [activeFilePath, editorMounted])

  // Debounced resize for DiffEditor (same pattern as above)
  useEffect(() => {
    const editor = diffEditorRef.current
    if (!editor) return
    let container: HTMLElement | null | undefined
    try { container = editor.getDomNode()?.parentElement } catch { return }
    if (!container) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const ro = new ResizeObserver(() => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => editor.layout(), 150)
    })
    ro.observe(container)
    return () => {
      if (timer) clearTimeout(timer)
      ro.disconnect()
    }
  }, [activeFilePath, editorMounted])

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    diffEditorRef.current = null // Clear stale diff editor ref
    monacoRef.current = monaco

    // Configure editor theme with neutral dark gray
    monaco.editor.defineTheme('kanban-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#1a1a1a',
        'editor.foreground': '#e0e0e0',
        'editor.lineHighlightBackground': '#2a2a2a',
        'editorLineNumber.foreground': '#666666',
        'editorLineNumber.activeForeground': '#e0e0e0',
        'editor.selectionBackground': '#404040',
        'editor.inactiveSelectionBackground': '#353535',
        'editorGutter.background': '#1a1a1a',
        'minimap.background': '#1f1f1f'
      }
    })
    monaco.editor.setTheme('kanban-dark')

    // Add save shortcut
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveFileRef.current()
    })

    // Force initial layout — the ResizeObserver effect may have run before
    // onMount (Monaco loads async), so the editor has no dimensions yet.
    // Also bump editorMounted to re-trigger the ResizeObserver setup.
    requestAnimationFrame(() => editor.layout())
    setEditorMounted(c => c + 1)
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === 's') {
          e.preventDefault()
          saveFile()
        } else if (e.key === 'w') {
          e.preventDefault()
          if (activeFilePath) {
            closeFile(activeFilePath)
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [saveFile, closeFile, activeFilePath])

  // Re-layout editors when panel becomes active (fixes zero-dimension rendering)
  useEffect(() => {
    const disposable = props.api.onDidActiveChange((e) => {
      if (e.isActive) {
        requestAnimationFrame(() => {
          editorRef.current?.layout()
          diffEditorRef.current?.layout()
        })
        // Delayed retry for when dockview hasn't finalized dimensions yet
        setTimeout(() => {
          editorRef.current?.layout()
          diffEditorRef.current?.layout()
        }, 50)
      }
    })
    return () => disposable.dispose()
  }, [props.api])

  // Expose openFile method globally for Directory panel
  useEffect(() => {
    (window as unknown as { editorOpenFile: (filePath: string, isPreview: boolean, showDiff?: boolean, gitProjectPath?: string, gitRelativePath?: string) => Promise<void> }).editorOpenFile = openFile
  }, [openFile])

  return (
    <div className="h-full w-full flex flex-col bg-dark-bg">
      {/* Tab bar */}
      {openFiles.length > 0 && (
        <div className="flex items-center border-b border-dark-border bg-dark-card overflow-x-auto hide-scrollbar">
          {/* Diff view mode toggle - segmented control */}
          {activeFile?.showDiff && (
            <div className="flex items-center px-2 border-r border-dark-border">
              <div className="flex items-center bg-dark-bg rounded overflow-hidden">
                <button
                  onClick={() => setDiffViewMode('split')}
                  className={`flex items-center gap-1 px-2 py-1 text-xs transition-colors ${
                    diffViewMode === 'split'
                      ? 'bg-dark-hover text-dark-text'
                      : 'text-dark-muted hover:text-dark-text'
                  }`}
                  title="Side-by-side view"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
                  </svg>
                  <span>Split</span>
                </button>
                <button
                  onClick={() => setDiffViewMode('inline')}
                  className={`flex items-center gap-1 px-2 py-1 text-xs transition-colors ${
                    diffViewMode === 'inline'
                      ? 'bg-dark-hover text-dark-text'
                      : 'text-dark-muted hover:text-dark-text'
                  }`}
                  title="Unified view"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  <span>Inline</span>
                </button>
              </div>
            </div>
          )}
          {openFiles.map((file) => (
            <div
              key={file.path}
              className={`group flex items-center gap-2 px-3 py-2 cursor-pointer border-r border-dark-border text-sm whitespace-nowrap flex-shrink-0 ${
                activeFilePath === file.path
                  ? 'bg-dark-bg text-white'
                  : 'text-dark-muted hover:text-dark-text hover:bg-dark-hover'
              }`}
              onClick={() => setActiveFilePath(file.path)}
            >
              <FileIcon name={file.name} isDirectory={false} className="w-4 h-4 flex-shrink-0" />
              <span className={file.isPreview ? 'italic' : ''}>
                {file.name}
              </span>
              {file.showDiff && (
                <span className="text-xs px-1 py-0.5 bg-blue-600 rounded text-white">diff</span>
              )}
              {file.isModified ? (
                <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    closeFile(file.path)
                  }}
                  className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-dark-border rounded transition-opacity"
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
          ))}
          {/* Auto-save toggle */}
          <div className="ml-auto flex-shrink-0 flex items-center px-2 border-l border-dark-border">
            <button
              onClick={() => { const next = !autoSave; setAutoSave(next); electron.setAutoSave(next) }}
              className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors ${
                autoSave
                  ? 'text-green-400 bg-green-400/10'
                  : 'text-dark-muted hover:text-dark-text hover:bg-dark-hover'
              }`}
              title={autoSave ? 'Auto-save enabled (click to disable)' : 'Enable auto-save'}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              <span>{autoSave ? 'Auto' : 'Auto'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Editor area */}
      <div ref={editorAreaRef} className="flex-1 min-h-0">
        {activeFile ? (
          activeFile.isImage && activeFile.imageDataUrl ? (
            <div className="h-full flex items-center justify-center overflow-auto bg-[#1a1a1a] p-8">
              <img
                src={activeFile.imageDataUrl}
                alt={activeFile.name}
                className="max-w-full max-h-full object-contain rounded"
                style={{ imageRendering: 'auto' }}
              />
            </div>
          ) : activeFile.showDiff && activeFile.gitOriginal !== undefined ? (
            <DiffEditor
              key={activeFile.path}
              height={editorAreaHeight || '100%'}
              language={getLanguage(activeFile.name)}
              original={activeFile.gitOriginal}
              modified={activeFile.content}
              loading={<div className="h-full flex items-center justify-center text-dark-muted text-sm">Loading diff...</div>}
              onMount={(editor, monaco) => {
                diffEditorRef.current = editor
                editorRef.current = null // Clear stale regular editor ref
                monacoRef.current = monaco
                monaco.editor.defineTheme('kanban-dark', {
                  base: 'vs-dark',
                  inherit: true,
                  rules: [],
                  colors: {
                    'editor.background': '#1a1a1a',
                    'diffEditor.insertedTextBackground': '#22c55e20',
                    'diffEditor.removedTextBackground': '#ef444420'
                  }
                })
                monaco.editor.setTheme('kanban-dark')
                requestAnimationFrame(() => editor.layout())
                setTimeout(() => editor.layout(), 100)
                setEditorMounted(c => c + 1)
              }}
              options={{
                fontSize: 13,
                fontFamily: 'Menlo, Monaco, "SF Mono", "Fira Code", Consolas, monospace',
                readOnly: true,
                renderSideBySide: diffViewMode === 'split',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                padding: { top: 8, bottom: 8 }
              }}
              theme="vs-dark"
            />
          ) : (
            <Editor
              height={editorAreaHeight || '100%'}
              language={getLanguage(activeFile.name)}
              value={activeFile.content}
              onChange={handleEditorChange}
              onMount={handleEditorMount}
              options={{
                fontSize: 13,
                fontFamily: 'Menlo, Monaco, "SF Mono", "Fira Code", Consolas, monospace',
                minimap: {
                  enabled: true,
                  maxColumn: 80,
                  renderCharacters: false,
                  showSlider: 'always',
                  side: 'right',
                  scale: 1
                },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                renderLineHighlight: 'line',
                tabSize: 2,
                insertSpaces: true,
                wordWrap: 'off',
                automaticLayout: false,
                padding: { top: 8, bottom: 8 },
                smoothScrolling: true,
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                bracketPairColorization: { enabled: true },
                guides: {
                  bracketPairs: true,
                  indentation: true
                }
              }}
              theme="vs-dark"
            />
          )
        ) : (
          <div className="h-full flex items-center justify-center text-dark-muted">
            <div className="text-center">
              <svg
                className="w-16 h-16 mx-auto mb-4 opacity-50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                />
              </svg>
              <p className="text-lg font-medium">No file open</p>
              <p className="text-sm mt-1 opacity-75">
                Select a file from the Directory panel
              </p>
              <div className="mt-4 text-xs opacity-50">
                <p>Cmd+S to save</p>
                <p>Cmd+W to close tab</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
