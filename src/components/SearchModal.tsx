import { useState, useEffect, useRef, useCallback } from 'react'
import { electron, SearchFileResult, SearchTextResult } from '../lib/electron'

type SearchMode = 'files' | 'text'

interface SearchModalProps {
  isOpen: boolean
  mode: SearchMode
  projectPath: string
  onClose: () => void
  onOpenFile: (filePath: string, line?: number) => void
}

export default function SearchModal({
  isOpen,
  mode,
  projectPath,
  onClose,
  onOpenFile
}: SearchModalProps) {
  const [query, setQuery] = useState('')
  const [fileResults, setFileResults] = useState<SearchFileResult[]>([])
  const [textResults, setTextResults] = useState<SearchTextResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

  // Combined results for navigation - files first, then text matches
  const results = mode === 'files'
    ? [...fileResults, ...textResults.map(t => ({ ...t, isTextResult: true }))]
    : textResults

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setFileResults([])
      setTextResults([])
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen, mode])

  // Debounced search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setFileResults([])
      setTextResults([])
      return
    }

    setIsLoading(true)
    try {
      if (mode === 'files') {
        // Search both file names and content for better UX
        const [fileResults, textResults] = await Promise.all([
          electron.searchFiles(projectPath, searchQuery),
          electron.searchText(projectPath, searchQuery)
        ])
        setFileResults(fileResults)
        setTextResults(textResults.slice(0, 20)) // Limit content results
      } else {
        const results = await electron.searchText(projectPath, searchQuery)
        setTextResults(results)
        setFileResults([])
      }
      setSelectedIndex(0)
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsLoading(false)
    }
  }, [mode, projectPath])

  // Handle query changes with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(query)
    }, 150)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [query, performSearch])

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current) {
      const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (results.length > 0) {
          const selected = results[selectedIndex]
          if ('isTextResult' in selected || 'line' in selected) {
            onOpenFile((selected as SearchTextResult).path, (selected as SearchTextResult).line)
          } else {
            onOpenFile((selected as SearchFileResult).path)
          }
          onClose()
        }
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }, [results, selectedIndex, mode, onOpenFile, onClose])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed top-[15%] left-1/2 -translate-x-1/2 w-[600px] max-w-[90vw] bg-dark-card border border-dark-border rounded-lg shadow-2xl z-50 overflow-hidden">
        {/* Search input */}
        <div className="flex items-center px-4 py-3 border-b border-dark-border">
          <svg
            className="w-5 h-5 text-dark-muted mr-3 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={mode === 'files' ? 'Search files and content...' : 'Search in files...'}
            className="flex-1 bg-transparent outline-none text-dark-text placeholder-dark-muted"
            autoComplete="off"
            spellCheck={false}
          />
          {isLoading && (
            <div className="w-4 h-4 border-2 border-dark-muted border-t-transparent rounded-full animate-spin" />
          )}
          <span className="ml-3 text-xs text-dark-muted">
            {mode === 'files' ? 'Cmd+P' : 'Cmd+Shift+F'}
          </span>
        </div>

        {/* Results */}
        <div
          ref={resultsRef}
          className="max-h-[400px] overflow-y-auto"
        >
          {results.length === 0 && query.trim() && !isLoading && (
            <div className="px-4 py-8 text-center text-dark-muted">
              No results found
            </div>
          )}

          {/* File name matches */}
          {mode === 'files' && fileResults.length > 0 && (
            <>
              <div className="px-4 py-1 text-xs text-dark-muted bg-dark-bg sticky top-0">
                Files
              </div>
              {fileResults.map((result, index) => (
                <div
                  key={result.path}
                  onClick={() => {
                    onOpenFile(result.path)
                    onClose()
                  }}
                  className={`px-4 py-2 cursor-pointer flex items-center gap-3 ${
                    index === selectedIndex ? 'bg-dark-hover' : 'hover:bg-dark-hover/50'
                  }`}
                >
                  <svg
                    className="w-4 h-4 text-dark-muted flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="text-dark-text truncate">{result.name}</div>
                    <div className="text-xs text-dark-muted truncate">{result.relativePath}</div>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Content matches (shown in files mode too) */}
          {mode === 'files' && textResults.length > 0 && (
            <>
              <div className="px-4 py-1 text-xs text-dark-muted bg-dark-bg sticky top-0">
                Content matches
              </div>
              {textResults.map((result, index) => (
                <div
                  key={`${result.path}:${result.line}`}
                  onClick={() => {
                    onOpenFile(result.path, result.line)
                    onClose()
                  }}
                  className={`px-4 py-2 cursor-pointer ${
                    index + fileResults.length === selectedIndex ? 'bg-dark-hover' : 'hover:bg-dark-hover/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-dark-text text-sm truncate">{result.relativePath}</span>
                    <span className="text-xs text-dark-muted">:{result.line}</span>
                  </div>
                  <div className="text-xs text-dark-muted font-mono truncate pl-4">
                    {result.content}
                  </div>
                </div>
              ))}
            </>
          )}

          {mode === 'text' && textResults.map((result, index) => (
            <div
              key={`${result.path}:${result.line}`}
              onClick={() => {
                onOpenFile(result.path, result.line)
                onClose()
              }}
              className={`px-4 py-2 cursor-pointer ${
                index === selectedIndex ? 'bg-dark-hover' : 'hover:bg-dark-hover/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-dark-text text-sm truncate">{result.relativePath}</span>
                <span className="text-xs text-dark-muted">:{result.line}</span>
              </div>
              <div className="text-xs text-dark-muted font-mono truncate pl-4">
                {result.content}
              </div>
            </div>
          ))}
        </div>

        {/* Footer with hints */}
        <div className="px-4 py-2 border-t border-dark-border flex items-center gap-4 text-xs text-dark-muted">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-dark-bg rounded text-[10px]">Enter</kbd>
            to open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-dark-bg rounded text-[10px]">Esc</kbd>
            to close
          </span>
        </div>
      </div>
    </>
  )
}
