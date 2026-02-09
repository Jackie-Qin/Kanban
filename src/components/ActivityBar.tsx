import { useCallback } from 'react'
import { DockviewApi } from 'dockview'

interface ActivityBarProps {
  apiRef: React.RefObject<DockviewApi | null>
  openPanelIds: string[]
  onTogglePanel: (panelId: string) => void
  onResetLayout: () => void
}

// Panel icons (20x20 for activity bar)
const PANEL_ICONS: Record<string, React.ReactNode> = {
  directory: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ),
  git: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  ),
  kanban: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="5" height="18" rx="1" />
      <rect x="10" y="3" width="5" height="12" rx="1" />
      <rect x="17" y="3" width="5" height="15" rx="1" />
    </svg>
  ),
  editor: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  ),
  terminal: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  )
}

const PANEL_LABELS: Record<string, string> = {
  directory: 'Explorer',
  git: 'Source Control',
  kanban: 'Kanban',
  editor: 'Editor',
  terminal: 'Terminal'
}

// Top section: sidebar panels. Bottom section: terminal
const TOP_PANELS = ['directory', 'git', 'kanban', 'editor']
const BOTTOM_PANELS = ['terminal']

export default function ActivityBar({
  apiRef,
  openPanelIds,
  onTogglePanel,
  onResetLayout
}: ActivityBarProps) {
  const handleClick = useCallback(
    (panelId: string) => {
      onTogglePanel(panelId)
    },
    [onTogglePanel]
  )

  const isActive = useCallback(
    (panelId: string) => {
      if (!apiRef.current) return false
      const panel = apiRef.current.getPanel(panelId)
      return panel?.api.isActive ?? false
    },
    [apiRef]
  )

  const renderIcon = (panelId: string) => {
    const isOpen = openPanelIds.includes(panelId)
    const active = isOpen && isActive(panelId)

    return (
      <button
        key={panelId}
        onClick={() => handleClick(panelId)}
        className={`activity-bar-icon ${active ? 'active' : ''} ${isOpen ? 'open' : ''}`}
        title={PANEL_LABELS[panelId]}
      >
        {PANEL_ICONS[panelId]}
      </button>
    )
  }

  return (
    <div className="activity-bar">
      <div className="activity-bar-top">
        {TOP_PANELS.map(renderIcon)}
      </div>
      <div className="activity-bar-bottom">
        {BOTTOM_PANELS.map(renderIcon)}
        {/* Reset layout button - shown when panels are closed */}
        {openPanelIds.length < 5 && (
          <button
            onClick={onResetLayout}
            className="activity-bar-icon reset"
            title="Reset Layout"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 1 9 9" />
              <polyline points="3 7 3 12 8 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
