import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { Project, Task, Label, AppData, ColumnId } from '../types'
import { electron } from '../lib/electron'

interface AppState extends AppData {
  isLoading: boolean
  closedProjectIds: string[]
  loadData: () => Promise<void>
  saveData: () => Promise<void>

  // Projects
  addProject: (name: string, path: string) => void
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

  loadData: async () => {
    try {
      const data = await electron.loadData()
      set({
        projects: data.projects || [],
        tasks: data.tasks || [],
        labels: data.labels || [],
        activeProjectId: data.activeProjectId,
        closedProjectIds: data.closedProjectIds || [],
        layouts: data.layouts || {},
        isLoading: false
      })
    } catch (error) {
      console.error('Failed to load data:', error)
      set({ isLoading: false })
    }
  },

  saveData: async () => {
    const { projects, tasks, labels, activeProjectId, closedProjectIds, layouts } = get()
    try {
      await electron.saveData({ projects, tasks, labels, activeProjectId, closedProjectIds, layouts })
    } catch (error) {
      console.error('Failed to save data:', error)
    }
  },

  // Projects
  addProject: (name, path) => {
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
    get().saveData()
  },

  updateProject: (id, updates) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      )
    }))
    get().saveData()
  },

  deleteProject: (id) => {
    set((state) => {
      const newProjects = state.projects.filter((p) => p.id !== id)
      const newTasks = state.tasks.filter((t) => t.projectId !== id)
      const newClosedIds = state.closedProjectIds.filter((pid) => pid !== id)
      let newActiveId = state.activeProjectId
      if (state.activeProjectId === id) {
        // Find next open project
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
    get().saveData()
  },

  closeProject: (id) => {
    set((state) => {
      const newClosedIds = [...state.closedProjectIds, id]
      let newActiveId = state.activeProjectId
      if (state.activeProjectId === id) {
        // Find next open project
        const openProjects = state.projects.filter((p) => !newClosedIds.includes(p.id))
        newActiveId = openProjects.length > 0 ? openProjects[0].id : null
      }
      return {
        closedProjectIds: newClosedIds,
        activeProjectId: newActiveId
      }
    })
    get().saveData()
  },

  reopenProject: (id) => {
    set((state) => ({
      closedProjectIds: state.closedProjectIds.filter((pid) => pid !== id),
      activeProjectId: id
    }))
    get().saveData()
  },

  setActiveProject: (id) => {
    set({ activeProjectId: id })
    get().saveData()
  },

  reorderProjects: (projectIds) => {
    set((state) => ({
      projects: projectIds
        .map((id, index) => {
          const project = state.projects.find((p) => p.id === id)
          return project ? { ...project, order: index } : null
        })
        .filter(Boolean) as Project[]
    }))
    get().saveData()
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
    get().saveData()
    return newTask
  },

  updateTask: (id, updates) => {
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      )
    }))
    get().saveData()
  },

  deleteTask: (id) => {
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id)
    }))
    get().saveData()
  },

  moveTask: (taskId, toColumn, newOrder) => {
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, column: toColumn, order: newOrder } : t
      )
    }))
    get().saveData()
  },

  reorderTasks: (columnId, taskIds) => {
    set((state) => ({
      tasks: state.tasks.map((task) => {
        const newIndex = taskIds.indexOf(task.id)
        if (newIndex !== -1) {
          return { ...task, column: columnId, order: newIndex }
        }
        return task
      })
    }))
    get().saveData()
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
    get().saveData()
  },

  updateLabel: (id, updates) => {
    set((state) => ({
      labels: state.labels.map((l) =>
        l.id === id ? { ...l, ...updates } : l
      )
    }))
    get().saveData()
  },

  deleteLabel: (id) => {
    set((state) => ({
      labels: state.labels.filter((l) => l.id !== id),
      tasks: state.tasks.map((t) => ({
        ...t,
        labels: t.labels.filter((labelId) => labelId !== id)
      }))
    }))
    get().saveData()
  },

  // Layouts
  saveLayout: (projectId, layout) => {
    set((state) => ({
      layouts: {
        ...state.layouts,
        [projectId]: layout
      }
    }))
    get().saveData()
  }
}))
