import { create } from 'zustand'

interface BadgeState {
  /** Project IDs that have terminal-done badges on the project tab */
  projectBadges: Set<string>
  /** Project IDs that have terminal-done badges on the activity bar terminal icon */
  terminalBadges: Set<string>

  addBadges: (projectId: string) => void
  dismissProjectBadge: (projectId: string) => void
  dismissTerminalBadge: (projectId: string) => void
}

export const useBadgeStore = create<BadgeState>((set) => ({
  projectBadges: new Set(),
  terminalBadges: new Set(),

  addBadges: (projectId) =>
    set((state) => {
      const p = new Set(state.projectBadges)
      const t = new Set(state.terminalBadges)
      p.add(projectId)
      t.add(projectId)
      return { projectBadges: p, terminalBadges: t }
    }),

  dismissProjectBadge: (projectId) =>
    set((state) => {
      if (!state.projectBadges.has(projectId)) return state
      const p = new Set(state.projectBadges)
      p.delete(projectId)
      return { projectBadges: p }
    }),

  dismissTerminalBadge: (projectId) =>
    set((state) => {
      if (!state.terminalBadges.has(projectId)) return state
      const t = new Set(state.terminalBadges)
      t.delete(projectId)
      return { terminalBadges: t }
    }),
}))
