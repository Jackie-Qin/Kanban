import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { Project, Task, Label, AppData, ColumnId } from '../types'
import { electron } from '../lib/electron'

interface AppState extends AppData {
  isLoading: boolean
  isSyncing: boolean // Prevents saves during reload
  closedProjectIds: string[]
  loadData: () => Promise<void>

  // Projects
  addProject: (name: string, path: string) => Promise<void>
  updateProject: (id: string, updates: Partial<Project>) => void
  deleteProject: (id: string) => void
  closeProject: (id: string) => void
  reopenProject: (id: string) => void
  setActiveProject: (id: string) => void
  reorderProjects: (projectIds: string[]) => void

  // Tasks
  addTask: (projectId: string, title: string, column: ColumnId) => Task
  updateTask: (id: string, updates: Partial<Task>) => void
  deleteTask: (id: string) => void
  moveTask: (taskId: string, toColumn: ColumnId, newOrder: number) => void
  reorderTasks: (columnId: ColumnId, taskIds: string[]) => void

  // Labels
  addLabel: (name: string, color: string) => void
  updateLabel: (id: string, updates: Partial<Label>) => void
  deleteLabel: (id: string) => void

  // Layouts
  saveLayout: (projectId: string, layout: unknown) => void
}

export const useStore = create<AppState>((set, get) => ({
  projects: [],
  tasks: [],
  labels: [],
  activeProjectId: null,
  closedProjectIds: [],
  layouts: {},
  isLoading: true,
  isSyncing: false,

  loadData: async () => {
    set({ isSyncing: true })
    try {
      const data = await electron.loadData()
      set({
        projects: data.projects || [],
        tasks: data.tasks || [],
        labels: data.labels || [],
        activeProjectId: data.activeProjectId,
        closedProjectIds: data.closedProjectIds || [],
        layouts: data.layouts || {},
        isLoading: false,
        isSyncing: false
      })
    } catch (error) {
      console.error('Failed to load data:', error)
      set({ isLoading: false, isSyncing: false })
    }
  },

  // Projects
  addProject: async (name, path) => {
    // Check if a project with this path already exists (in-memory first, then DB)
    const existing = get().projects.find((p) => p.path === path)
    if (existing) {
      // Reopen if closed, set active, update name if different
      const updates: Partial<Project> = {}
      if (existing.name !== name) updates.name = name
      set((state) => ({
        projects: Object.keys(updates).length > 0
          ? state.projects.map((p) => p.id === existing.id ? { ...p, ...updates } : p)
          : state.projects,
        closedProjectIds: state.closedProjectIds.filter((id) => id !== existing.id),
        activeProjectId: existing.id
      }))
      if (Object.keys(updates).length > 0) {
        const updated = get().projects.find((p) => p.id === existing.id)
        if (updated) electron.dbUpsertProject(updated)
      }
      electron.dbSetAppState('activeProjectId', existing.id)
      electron.dbSetAppState('closedProjectIds', JSON.stringify(get().closedProjectIds))
      return
    }

    // Check DB for a project that was deleted from memory but still has data
    const dbProject = await electron.dbGetProjectByPath(path)
    if (dbProject) {
      // Restore from DB — reuse same ID so existing tasks reconnect
      const restored: Project = { ...dbProject, name, order: get().projects.length }
      set((state) => ({
        projects: [...state.projects, restored],
        closedProjectIds: state.closedProjectIds.filter((id) => id !== restored.id),
        activeProjectId: restored.id
      }))
      electron.dbUpsertProject(restored)
      electron.dbSetAppState('activeProjectId', restored.id)
      electron.dbSetAppState('closedProjectIds', JSON.stringify(get().closedProjectIds))
      return
    }

    // Truly new project
    const newProject: Project = {
      id: uuidv4(),
      name,
      path,
      order: get().projects.length
    }
    set((state) => ({
      projects: [...state.projects, newProject],
      activeProjectId: state.activeProjectId || newProject.id
    }))
    electron.dbUpsertProject(newProject)
    const { activeProjectId } = get()
    electron.dbSetAppState('activeProjectId', activeProjectId)
  },

  updateProject: (id, updates) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      )
    }))
    const updated = get().projects.find((p) => p.id === id)
    if (updated) electron.dbUpsertProject(updated)
  },

  deleteProject: (id) => {
    // Clean up persisted terminal state and buffers
    electron.deleteTerminalState(id)
    electron.deleteTerminalBuffers(id)

    // Clean up attachments for all tasks in the project
    const tasksToDelete = get().tasks.filter((t) => t.projectId === id)
    for (const t of tasksToDelete) {
      electron.deleteTaskAttachments(t.id)
    }

    set((state) => {
      const newProjects = state.projects.filter((p) => p.id !== id)
      const newTasks = state.tasks.filter((t) => t.projectId !== id)
      const newClosedIds = state.closedProjectIds.filter((pid) => pid !== id)
      let newActiveId = state.activeProjectId
      if (state.activeProjectId === id) {
        const openProjects = newProjects.filter((p) => !newClosedIds.includes(p.id))
        newActiveId = openProjects.length > 0 ? openProjects[0].id : null
      }
      return {
        projects: newProjects,
        tasks: newTasks,
        closedProjectIds: newClosedIds,
        activeProjectId: newActiveId
      }
    })
    electron.dbDeleteProject(id)
    const { activeProjectId, closedProjectIds } = get()
    electron.dbSetAppState('activeProjectId', activeProjectId)
    electron.dbSetAppState('closedProjectIds', JSON.stringify(closedProjectIds))
  },

  closeProject: (id) => {
    set((state) => {
      const newClosedIds = [...state.closedProjectIds, id]
      let newActiveId = state.activeProjectId
      if (state.activeProjectId === id) {
        const openProjects = state.projects.filter((p) => !newClosedIds.includes(p.id))
        newActiveId = openProjects.length > 0 ? openProjects[0].id : null
      }
      return {
        closedProjectIds: newClosedIds,
        activeProjectId: newActiveId
      }
    })
    const { activeProjectId, closedProjectIds } = get()
    electron.dbSetAppState('closedProjectIds', JSON.stringify(closedProjectIds))
    electron.dbSetAppState('activeProjectId', activeProjectId)
  },

  reopenProject: (id) => {
    set((state) => ({
      closedProjectIds: state.closedProjectIds.filter((pid) => pid !== id),
      activeProjectId: id
    }))
    const { closedProjectIds } = get()
    electron.dbSetAppState('closedProjectIds', JSON.stringify(closedProjectIds))
    electron.dbSetAppState('activeProjectId', id)
  },

  setActiveProject: (id) => {
    set({ activeProjectId: id })
    electron.dbSetAppState('activeProjectId', id)
  },

  reorderProjects: (projectIds) => {
    const reordered = projectIds
      .map((id, index) => {
        const project = get().projects.find((p) => p.id === id)
        return project ? { ...project, order: index } : null
      })
      .filter(Boolean) as Project[]

    set({ projects: reordered })
    electron.dbBatchUpsertProjects(reordered)
  },

  // Tasks
  addTask: (projectId, title, column) => {
    const tasksInColumn = get().tasks.filter(
      (t) => t.projectId === projectId && t.column === column
    )
    const newTask: Task = {
      id: uuidv4(),
      projectId,
      title,
      description: '',
      column,
      labels: [],
      dueDate: null,
      createdAt: new Date().toISOString(),
      order: tasksInColumn.length
    }
    set((state) => ({
      tasks: [...state.tasks, newTask]
    }))
    electron.dbUpsertTask(newTask)
    return newTask
  },

  updateTask: (id, updates) => {
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      )
    }))
    const updated = get().tasks.find((t) => t.id === id)
    if (updated) electron.dbUpsertTask(updated)
  },

  deleteTask: (id) => {
    electron.deleteTaskAttachments(id)
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id)
    }))
    electron.dbDeleteTask(id)
  },

  moveTask: (taskId, toColumn, newOrder) => {
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, column: toColumn, order: newOrder } : t
      )
    }))
    const updated = get().tasks.find((t) => t.id === taskId)
    if (updated) electron.dbUpsertTask(updated)
  },

  reorderTasks: (columnId, taskIds) => {
    const affected: Task[] = []
    set((state) => ({
      tasks: state.tasks.map((task) => {
        const newIndex = taskIds.indexOf(task.id)
        if (newIndex !== -1) {
          const updated = { ...task, column: columnId, order: newIndex }
          affected.push(updated)
          return updated
        }
        return task
      })
    }))
    if (affected.length > 0) electron.dbBatchUpsertTasks(affected)
  },

  // Labels
  addLabel: (name, color) => {
    const newLabel: Label = {
      id: uuidv4(),
      name,
      color
    }
    set((state) => ({
      labels: [...state.labels, newLabel]
    }))
    electron.dbUpsertLabel(newLabel)
  },

  updateLabel: (id, updates) => {
    set((state) => ({
      labels: state.labels.map((l) =>
        l.id === id ? { ...l, ...updates } : l
      )
    }))
    const updated = get().labels.find((l) => l.id === id)
    if (updated) electron.dbUpsertLabel(updated)
  },

  deleteLabel: (id) => {
    // Get tasks that have this label so we can update them in DB
    const affectedTasks: Task[] = []
    set((state) => ({
      labels: state.labels.filter((l) => l.id !== id),
      tasks: state.tasks.map((t) => {
        if (t.labels.includes(id)) {
          const updated = { ...t, labels: t.labels.filter((labelId) => labelId !== id) }
          affectedTasks.push(updated)
          return updated
        }
        return t
      })
    }))
    electron.dbDeleteLabel(id)
    // The db-delete-label handler already strips from tasks in DB,
    // but we also updated them in the store above for consistency
  },

  // Layouts
  saveLayout: (projectId, layout) => {
    set((state) => ({
      layouts: {
        ...state.layouts,
        [projectId]: layout
      }
    }))
    electron.dbSaveLayout(projectId, layout)
  }
}))
