export interface Project {
  id: string
  name: string
  path: string
  order: number
}

export interface TaskAttachment {
  id: string
  name: string
  path: string
  type: string
  size: number
  addedAt: string
}

export interface Task {
  id: string
  projectId: string
  title: string
  description: string
  column: ColumnId
  labels: string[]
  dueDate: string | null
  createdAt: string
  order: number
  branch?: string // Linked Git branch name
  archived?: boolean
  attachments?: TaskAttachment[]
}

export interface Label {
  id: string
  name: string
  color: string
}

export type ColumnId = 'backlog' | 'todo' | 'in-progress' | 'review' | 'done'

export interface Column {
  id: ColumnId
  title: string
  color: string
}

export interface AppData {
  projects: Project[]
  tasks: Task[]
  labels: Label[]
  activeProjectId: string | null
  closedProjectIds?: string[] // Projects that are hidden/closed but not deleted
  layouts?: {
    [projectId: string]: unknown // Dockview serialized layout
  }
}

export const COLUMNS: Column[] = [
  { id: 'backlog', title: 'Backlog', color: '#6b7280' },
  { id: 'todo', title: 'Todo', color: '#eab308' },
  { id: 'in-progress', title: 'In Progress', color: '#a855f7' },
  { id: 'review', title: 'Review', color: '#22c55e' },
  { id: 'done', title: 'Done', color: '#10b981' }
]
