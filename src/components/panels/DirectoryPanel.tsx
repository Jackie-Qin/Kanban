import { useState, useEffect, useCallback } from 'react'
import { IDockviewPanelProps } from 'dockview'
import { electron, FileEntry } from '../../lib/electron'
import { dirCache } from '../../lib/projectCache'
import { eventBus } from '../../lib/eventBus'
import FileIcon from '../FileIcon'

interface DirectoryPanelParams {
  projectId: string
  projectPath: string
  onFileSelect?: (filePath: string, preview: boolean) => void
}

interface TreeNode extends FileEntry {
  children?: TreeNode[]
  isExpanded?: boolean
  isLoading?: boolean
}

interface FileTreeItemProps {
  node: TreeNode
  depth: number
  showHidden: boolean
  selectedPaths: Set<string>
  onToggle: (path: string) => void
  onSelect: (path: string, isDirectory: boolean) => void
  onDoubleClick: (path: string, isDirectory: boolean) => void
  onMultiSelect: (path: string) => void
  onContextMenu: (e: React.MouseEvent, node: TreeNode) => void
}

function FileTreeItem({
  node,
  depth,
  showHidden,
  selectedPaths,
  onToggle,
  onSelect,
  onDoubleClick,
  onMultiSelect,
  onContextMenu
}: FileTreeItemProps) {
  if (node.isHidden && !showHidden) return null

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (e.metaKey || e.ctrlKey) {
      onMultiSelect(node.path)
      return
    }
    if (node.isDirectory) {
      onToggle(node.path)
    } else {
      onSelect(node.path, node.isDirectory)
    }
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDoubleClick(node.path, node.isDirectory)
  }

  const isSelected = selectedPaths.has(node.path)

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 px-2 py-1 cursor-pointer hover:bg-dark-hover rounded text-sm group ${isSelected ? 'bg-blue-500/20' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        draggable="true"
        onDragStart={(e) => {
          e.dataTransfer.setData('application/x-kanban-file', node.path)
          e.dataTransfer.setData('text/plain', node.path)
          e.dataTransfer.effectAllowed = 'copy'
        }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => onContextMenu(e, node)}
      >
        {node.isDirectory && (
          <span className="w-4 text-center text-[10px] text-dark-muted flex-shrink-0">
            {node.isLoading ? (
              <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : node.isExpanded ? (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </span>
        )}
        {/* For files: spacer for chevron alignment + file icon (VS Code style - no folder icons) */}
        {!node.isDirectory && (
          <>
            <span className="w-4 flex-shrink-0" />
            <FileIcon name={node.name} isDirectory={false} className="w-4 h-4 flex-shrink-0" />
          </>
        )}
        <span
          className={`truncate ${node.isHidden ? 'text-dark-muted' : 'text-dark-text'}`}
        >
          {node.name}
        </span>
      </div>
      {node.isDirectory && node.isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              showHidden={showHidden}
              selectedPaths={selectedPaths}
              onToggle={onToggle}
              onSelect={onSelect}
              onDoubleClick={onDoubleClick}
              onMultiSelect={onMultiSelect}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function DirectoryPanel({ params }: IDockviewPanelProps<DirectoryPanelParams>) {
  const { projectPath, onFileSelect } = params
  const [tree, setTree] = useState<TreeNode[]>([])
  const [showHidden, setShowHidden] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    node: TreeNode | null
  } | null>(null)
  const [isCreating, setIsCreating] = useState<'file' | 'folder' | null>(null)
  const [newItemName, setNewItemName] = useState('')
  const [createPath, setCreatePath] = useState('')
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())

  // Load initial directory — restore cache instantly, then refresh in background
  useEffect(() => {
    if (!projectPath) return
    const cached = dirCache.get(projectPath)
    if (cached) {
      setTree(cached)
    }
    loadDirectory(projectPath)
  }, [projectPath])

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null)
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [])

  const loadDirectory = async (dirPath: string) => {
    const entries = await electron.fsReadDirectory(dirPath)
    const nodes: TreeNode[] = entries.map((entry) => ({
      ...entry,
      isExpanded: false,
      children: entry.isDirectory ? undefined : undefined
    }))
    setTree(nodes)
    // Only cache root-level loads (not subfolder refreshes)
    if (dirPath === projectPath) {
      dirCache.set(projectPath, nodes)
    }
  }

  const loadChildren = useCallback(async (dirPath: string): Promise<TreeNode[]> => {
    const entries = await electron.fsReadDirectory(dirPath)
    return entries.map((entry) => ({
      ...entry,
      isExpanded: false,
      children: entry.isDirectory ? undefined : undefined
    }))
  }, [])

  const updateTreeNode = useCallback(
    (nodes: TreeNode[], path: string, updater: (node: TreeNode) => TreeNode): TreeNode[] => {
      return nodes.map((node) => {
        if (node.path === path) {
          return updater(node)
        }
        if (node.children) {
          return {
            ...node,
            children: updateTreeNode(node.children, path, updater)
          }
        }
        return node
      })
    },
    []
  )

  const handleToggle = useCallback(
    async (path: string) => {
      // Find the node
      const findNode = (nodes: TreeNode[]): TreeNode | undefined => {
        for (const node of nodes) {
          if (node.path === path) return node
          if (node.children) {
            const found = findNode(node.children)
            if (found) return found
          }
        }
        return undefined
      }

      const node = findNode(tree)
      if (!node || !node.isDirectory) return

      if (node.isExpanded) {
        // Collapse
        setTree((prev) =>
          updateTreeNode(prev, path, (n) => ({ ...n, isExpanded: false }))
        )
      } else {
        // Expand and load children
        setTree((prev) =>
          updateTreeNode(prev, path, (n) => ({ ...n, isLoading: true }))
        )

        const children = await loadChildren(path)

        setTree((prev) =>
          updateTreeNode(prev, path, (n) => ({
            ...n,
            isExpanded: true,
            isLoading: false,
            children
          }))
        )
      }
    },
    [tree, updateTreeNode, loadChildren]
  )

  const handleSelect = useCallback(
    (filePath: string, isDirectory: boolean) => {
      if (!isDirectory) {
        eventBus.emit('editor:open-file', { path: filePath, preview: true })
        eventBus.emit('panel:focus', { panelId: 'editor' })
        onFileSelect?.(filePath, true)
      }
    },
    [onFileSelect]
  )

  const handleDoubleClick = useCallback(
    (filePath: string, isDirectory: boolean) => {
      if (!isDirectory) {
        eventBus.emit('editor:open-file', { path: filePath, preview: false })
        eventBus.emit('panel:focus', { panelId: 'editor' })
        onFileSelect?.(filePath, false)
      }
    },
    [onFileSelect]
  )

  const handleContextMenu = useCallback((e: React.MouseEvent, node: TreeNode) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, node })
  }, [])

  const handleNewFile = useCallback(() => {
    if (!contextMenu?.node) return
    const targetPath = contextMenu.node.isDirectory
      ? contextMenu.node.path
      : contextMenu.node.path.substring(0, contextMenu.node.path.lastIndexOf('/'))
    setCreatePath(targetPath)
    setIsCreating('file')
    setNewItemName('')
    setContextMenu(null)
  }, [contextMenu])

  const handleNewFolder = useCallback(() => {
    if (!contextMenu?.node) return
    const targetPath = contextMenu.node.isDirectory
      ? contextMenu.node.path
      : contextMenu.node.path.substring(0, contextMenu.node.path.lastIndexOf('/'))
    setCreatePath(targetPath)
    setIsCreating('folder')
    setNewItemName('')
    setContextMenu(null)
  }, [contextMenu])

  const handleDelete = useCallback(async () => {
    if (!contextMenu?.node) return
    const confirmed = window.confirm(
      `Are you sure you want to delete "${contextMenu.node.name}"?`
    )
    if (confirmed) {
      const success = await electron.fsDelete(contextMenu.node.path)
      if (success) {
        // Refresh parent directory
        loadDirectory(projectPath)
      }
    }
    setContextMenu(null)
  }, [contextMenu, projectPath])

  const handleCopyPath = useCallback(() => {
    if (!contextMenu?.node) return
    navigator.clipboard.writeText(contextMenu.node.path)
    setContextMenu(null)
  }, [contextMenu])

  const handleMultiSelect = useCallback((path: string) => {
    setSelectedPaths(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const handleDeleteSelected = useCallback(async () => {
    if (selectedPaths.size === 0) return
    const confirmed = window.confirm(`Are you sure you want to delete ${selectedPaths.size} item(s)?`)
    if (!confirmed) return
    for (const p of selectedPaths) {
      await electron.fsDelete(p)
    }
    setSelectedPaths(new Set())
    loadDirectory(projectPath)
  }, [selectedPaths, projectPath])

  const handleCopySelectedPaths = useCallback(() => {
    if (selectedPaths.size === 0) return
    navigator.clipboard.writeText(Array.from(selectedPaths).join('\n'))
    setSelectedPaths(new Set())
  }, [selectedPaths])

  const handleCreateSubmit = useCallback(async () => {
    if (!newItemName.trim()) return

    const fullPath = `${createPath}/${newItemName.trim()}`
    const success =
      isCreating === 'file'
        ? await electron.fsCreateFile(fullPath)
        : await electron.fsCreateDirectory(fullPath)

    if (success) {
      loadDirectory(projectPath)
    }
    setIsCreating(null)
    setNewItemName('')
  }, [newItemName, createPath, isCreating, projectPath])

  const handleRefresh = useCallback(() => {
    if (projectPath) {
      loadDirectory(projectPath)
    }
  }, [projectPath])

  // Filter tree based on search query
  const filterTree = useCallback(
    (nodes: TreeNode[], query: string): TreeNode[] => {
      if (!query) return nodes
      const lowerQuery = query.toLowerCase()

      return nodes
        .map((node) => {
          if (node.name.toLowerCase().includes(lowerQuery)) {
            return node
          }
          if (node.children) {
            const filteredChildren = filterTree(node.children, query)
            if (filteredChildren.length > 0) {
              return { ...node, children: filteredChildren, isExpanded: true }
            }
          }
          return null
        })
        .filter(Boolean) as TreeNode[]
    },
    []
  )

  const displayTree = searchQuery ? filterTree(tree, searchQuery) : tree

  return (
    <div className="h-full w-full flex flex-col bg-dark-bg text-dark-text">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-dark-border">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-dark-hover border border-dark-border rounded px-3 py-1.5 text-sm text-dark-text placeholder-dark-muted focus:outline-none focus:border-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-dark-muted hover:text-dark-text"
            >
              ×
            </button>
          )}
        </div>
        <button
          onClick={() => setShowHidden(!showHidden)}
          className={`p-1.5 rounded text-sm transition-colors ${
            showHidden
              ? 'bg-blue-600 text-white'
              : 'text-dark-muted hover:text-dark-text hover:bg-dark-hover'
          }`}
          title={showHidden ? 'Hide hidden files' : 'Show hidden files'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={
                showHidden
                  ? 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'
                  : 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21'
              }
            />
          </svg>
        </button>
        <button
          onClick={handleRefresh}
          className="p-1.5 rounded text-dark-muted hover:text-dark-text hover:bg-dark-hover transition-colors"
          title="Refresh"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      {/* Create new item input */}
      {isCreating && (
        <div className="flex items-center gap-2 px-3 py-2 bg-dark-hover border-b border-dark-border">
          <span className="text-sm">{isCreating === 'file' ? '📄' : '📁'}</span>
          <input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateSubmit()
              if (e.key === 'Escape') setIsCreating(null)
            }}
            placeholder={`New ${isCreating}...`}
            className="flex-1 bg-dark-bg border border-dark-border rounded px-2 py-1 text-sm text-dark-text focus:outline-none focus:border-blue-500"
            autoFocus
          />
          <button
            onClick={handleCreateSubmit}
            className="px-2 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            Create
          </button>
          <button
            onClick={() => setIsCreating(null)}
            className="px-2 py-1 text-dark-muted text-sm hover:text-dark-text"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Selection bar */}
      {selectedPaths.size > 0 && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-blue-500/10 border-b border-dark-border">
          <span className="text-xs text-blue-400">{selectedPaths.size} selected</span>
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopySelectedPaths}
              className="text-xs px-2 py-0.5 text-dark-muted hover:text-dark-text hover:bg-dark-border rounded transition-colors"
              title="Copy paths"
            >
              Copy Paths
            </button>
            <button
              onClick={handleDeleteSelected}
              className="text-xs px-2 py-0.5 text-red-400 hover:text-red-300 hover:bg-dark-border rounded transition-colors"
              title="Delete selected"
            >
              Delete
            </button>
            <button
              onClick={() => setSelectedPaths(new Set())}
              className="text-xs px-1.5 py-0.5 text-dark-muted hover:text-dark-text hover:bg-dark-border rounded transition-colors"
              title="Clear selection"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* File tree */}
      <div className="flex-1 overflow-auto py-2">
        {displayTree.length === 0 ? (
          <div className="text-center text-dark-muted py-8 text-sm">
            {searchQuery ? 'No files found' : 'No files'}
          </div>
        ) : (
          displayTree.map((node) => (
            <FileTreeItem
              key={node.path}
              node={node}
              depth={0}
              showHidden={showHidden}
              selectedPaths={selectedPaths}
              onToggle={handleToggle}
              onSelect={handleSelect}
              onDoubleClick={handleDoubleClick}
              onMultiSelect={handleMultiSelect}
              onContextMenu={handleContextMenu}
            />
          ))
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed bg-dark-card border border-dark-border rounded-lg shadow-lg py-1 z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={handleNewFile}
            className="w-full px-4 py-2 text-left text-sm hover:bg-dark-hover"
          >
            New File
          </button>
          <button
            onClick={handleNewFolder}
            className="w-full px-4 py-2 text-left text-sm hover:bg-dark-hover"
          >
            New Folder
          </button>
          <div className="h-px bg-dark-border my-1" />
          {selectedPaths.size > 1 ? (
            <>
              <button
                onClick={() => { handleCopySelectedPaths(); setContextMenu(null) }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-dark-hover"
              >
                Copy {selectedPaths.size} Paths
              </button>
              <div className="h-px bg-dark-border my-1" />
              <button
                onClick={() => { handleDeleteSelected(); setContextMenu(null) }}
                className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-dark-hover"
              >
                Delete {selectedPaths.size} Items
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleCopyPath}
                className="w-full px-4 py-2 text-left text-sm hover:bg-dark-hover"
              >
                Copy Path
              </button>
              <div className="h-px bg-dark-border my-1" />
              <button
                onClick={handleDelete}
                className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-dark-hover"
              >
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
