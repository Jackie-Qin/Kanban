import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '../store/useStore'
import { act } from '@testing-library/react'
import { electron } from '../lib/electron'

// Reset store before each test
beforeEach(() => {
  const { setState } = useStore
  act(() => {
    setState({
      projects: [],
      tasks: [],
      labels: [
        { id: 'bug', name: 'Bug', color: '#ef4444' },
        { id: 'feature', name: 'Feature', color: '#22c55e' }
      ],
      activeProjectId: null,
      closedProjectIds: [],
      layouts: {},
      isLoading: false,
      isSyncing: false
    })
  })
})

describe('Projects', () => {
  it('addProject creates a project and sets it active if none exists', async () => {
    await useStore.getState().addProject('Test Project', '/tmp/test')

    const state = useStore.getState()
    expect(state.projects).toHaveLength(1)
    expect(state.projects[0].name).toBe('Test Project')
    expect(state.projects[0].path).toBe('/tmp/test')
    expect(state.projects[0].order).toBe(0)
    expect(state.activeProjectId).toBe(state.projects[0].id)
  })

  it('addProject does not override existing activeProjectId', async () => {
    await useStore.getState().addProject('First', '/tmp/first')
    const firstId = useStore.getState().projects[0].id

    await useStore.getState().addProject('Second', '/tmp/second')
    expect(useStore.getState().activeProjectId).toBe(firstId)
    expect(useStore.getState().projects).toHaveLength(2)
  })

  it('updateProject updates the specified project', async () => {
    await useStore.getState().addProject('Old Name', '/tmp/test')
    const id = useStore.getState().projects[0].id

    useStore.getState().updateProject(id, { name: 'New Name' })
    expect(useStore.getState().projects[0].name).toBe('New Name')
    expect(useStore.getState().projects[0].path).toBe('/tmp/test') // unchanged
  })

  it('deleteProject removes project and its tasks', async () => {
    await useStore.getState().addProject('Project A', '/tmp/a')
    const projectId = useStore.getState().projects[0].id

    useStore.getState().addTask(projectId, 'Task 1', 'todo')
    useStore.getState().addTask(projectId, 'Task 2', 'done')
    expect(useStore.getState().tasks).toHaveLength(2)

    useStore.getState().deleteProject(projectId)
    expect(useStore.getState().projects).toHaveLength(0)
    expect(useStore.getState().tasks).toHaveLength(0)
    expect(useStore.getState().activeProjectId).toBeNull()
  })

  it('closeProject hides the project and switches active', async () => {
    await useStore.getState().addProject('A', '/tmp/a')
    await useStore.getState().addProject('B', '/tmp/b')
    const [a, b] = useStore.getState().projects

    useStore.getState().setActiveProject(a.id)
    useStore.getState().closeProject(a.id)

    expect(useStore.getState().closedProjectIds).toContain(a.id)
    expect(useStore.getState().activeProjectId).toBe(b.id)
  })

  it('reopenProject restores a closed project', async () => {
    await useStore.getState().addProject('A', '/tmp/a')
    const id = useStore.getState().projects[0].id

    useStore.getState().closeProject(id)
    expect(useStore.getState().closedProjectIds).toContain(id)

    useStore.getState().reopenProject(id)
    expect(useStore.getState().closedProjectIds).not.toContain(id)
    expect(useStore.getState().activeProjectId).toBe(id)
  })

  it('reorderProjects updates order', async () => {
    await useStore.getState().addProject('A', '/tmp/a')
    await useStore.getState().addProject('B', '/tmp/b')
    await useStore.getState().addProject('C', '/tmp/c')
    const [a, b, c] = useStore.getState().projects

    useStore.getState().reorderProjects([c.id, a.id, b.id])
    const reordered = useStore.getState().projects
    expect(reordered[0].id).toBe(c.id)
    expect(reordered[0].order).toBe(0)
    expect(reordered[1].id).toBe(a.id)
    expect(reordered[1].order).toBe(1)
    expect(reordered[2].id).toBe(b.id)
    expect(reordered[2].order).toBe(2)
  })
})

describe('Tasks', () => {
  let projectId: string

  beforeEach(async () => {
    await useStore.getState().addProject('Test', '/tmp/test')
    projectId = useStore.getState().projects[0].id
  })

  it('addTask creates a task in the correct column', () => {
    const task = useStore.getState().addTask(projectId, 'My Task', 'in-progress')

    expect(task.title).toBe('My Task')
    expect(task.column).toBe('in-progress')
    expect(task.projectId).toBe(projectId)
    expect(task.order).toBe(0)
    expect(task.labels).toEqual([])
    expect(task.description).toBe('')

    const state = useStore.getState()
    expect(state.tasks).toHaveLength(1)
    expect(state.tasks[0].id).toBe(task.id)
  })

  it('addTask assigns correct order based on existing tasks in column', () => {
    useStore.getState().addTask(projectId, 'First', 'todo')
    useStore.getState().addTask(projectId, 'Second', 'todo')
    const third = useStore.getState().addTask(projectId, 'Third', 'todo')

    expect(third.order).toBe(2)
  })

  it('updateTask modifies specific fields', () => {
    const task = useStore.getState().addTask(projectId, 'Original', 'todo')

    useStore.getState().updateTask(task.id, {
      title: 'Updated',
      description: 'A description',
      labels: ['bug']
    })

    const updated = useStore.getState().tasks[0]
    expect(updated.title).toBe('Updated')
    expect(updated.description).toBe('A description')
    expect(updated.labels).toEqual(['bug'])
    expect(updated.column).toBe('todo') // unchanged
  })

  it('deleteTask removes the task', () => {
    const task = useStore.getState().addTask(projectId, 'Delete me', 'todo')
    expect(useStore.getState().tasks).toHaveLength(1)

    useStore.getState().deleteTask(task.id)
    expect(useStore.getState().tasks).toHaveLength(0)
  })

  it('moveTask changes column and order', () => {
    const task = useStore.getState().addTask(projectId, 'Move me', 'todo')

    useStore.getState().moveTask(task.id, 'done', 5)

    const moved = useStore.getState().tasks[0]
    expect(moved.column).toBe('done')
    expect(moved.order).toBe(5)
  })

  it('reorderTasks updates column and order for all specified tasks', () => {
    const t1 = useStore.getState().addTask(projectId, 'A', 'todo')
    const t2 = useStore.getState().addTask(projectId, 'B', 'todo')
    const t3 = useStore.getState().addTask(projectId, 'C', 'backlog')

    // Reorder: move t3 into 'todo' alongside t2, t1
    useStore.getState().reorderTasks('todo', [t3.id, t2.id, t1.id])

    const tasks = useStore.getState().tasks
    const t3Updated = tasks.find(t => t.id === t3.id)!
    const t2Updated = tasks.find(t => t.id === t2.id)!
    const t1Updated = tasks.find(t => t.id === t1.id)!

    expect(t3Updated.column).toBe('todo')
    expect(t3Updated.order).toBe(0)
    expect(t2Updated.order).toBe(1)
    expect(t1Updated.order).toBe(2)
  })
})

describe('Labels', () => {
  it('addLabel creates a label', () => {
    useStore.getState().addLabel('Critical', '#ff0000')

    const labels = useStore.getState().labels
    const added = labels.find(l => l.name === 'Critical')
    expect(added).toBeDefined()
    expect(added!.color).toBe('#ff0000')
  })

  it('updateLabel modifies a label', () => {
    useStore.getState().addLabel('Temp', '#000')
    const id = useStore.getState().labels.find(l => l.name === 'Temp')!.id

    useStore.getState().updateLabel(id, { name: 'Updated', color: '#fff' })

    const updated = useStore.getState().labels.find(l => l.id === id)!
    expect(updated.name).toBe('Updated')
    expect(updated.color).toBe('#fff')
  })

  it('deleteLabel removes label and strips it from tasks', async () => {
    await useStore.getState().addProject('P', '/tmp/p')
    const pid = useStore.getState().projects[0].id
    const task = useStore.getState().addTask(pid, 'Task', 'todo')

    // Assign the 'bug' label
    useStore.getState().updateTask(task.id, { labels: ['bug', 'feature'] })
    expect(useStore.getState().tasks[0].labels).toEqual(['bug', 'feature'])

    // Delete 'bug' label
    useStore.getState().deleteLabel('bug')

    expect(useStore.getState().labels.find(l => l.id === 'bug')).toBeUndefined()
    expect(useStore.getState().tasks[0].labels).toEqual(['feature'])
  })
})

describe('Layouts', () => {
  it('saveLayout stores layout per project', () => {
    const mockLayout = { panels: ['kanban', 'editor'] }

    useStore.getState().saveLayout('project-1', mockLayout)
    const layouts1 = useStore.getState().layouts!
    expect(layouts1['project-1']).toEqual(mockLayout)

    useStore.getState().saveLayout('project-2', { panels: ['git'] })
    const layouts2 = useStore.getState().layouts!
    expect(layouts2['project-1']).toEqual(mockLayout)
    expect(layouts2['project-2']).toEqual({ panels: ['git'] })
  })

  it('saveLayout with null clears layout', () => {
    useStore.getState().saveLayout('project-1', { test: true })
    useStore.getState().saveLayout('project-1', null)

    expect(useStore.getState().layouts!['project-1']).toBeNull()
  })
})

describe('Targeted persistence', () => {
  it('addProject calls dbUpsertProject and dbSetAppState', async () => {
    (electron.dbUpsertProject as ReturnType<typeof import('vitest').vi.fn>).mockClear();
    (electron.dbSetAppState as ReturnType<typeof import('vitest').vi.fn>).mockClear()

    await useStore.getState().addProject('Test', '/tmp')

    expect(useStore.getState().projects).toHaveLength(1)
    expect(electron.dbUpsertProject).toHaveBeenCalledTimes(1)
    expect(electron.dbSetAppState).toHaveBeenCalledWith('activeProjectId', expect.any(String))
  })

  it('saveLayout calls dbSaveLayout directly', () => {
    (electron.dbSaveLayout as ReturnType<typeof import('vitest').vi.fn>).mockClear()

    useStore.getState().saveLayout('proj-1', { panels: ['kanban'] })

    expect(electron.dbSaveLayout).toHaveBeenCalledWith('proj-1', { panels: ['kanban'] })
  })

  it('setActiveProject calls dbSetAppState', () => {
    (electron.dbSetAppState as ReturnType<typeof import('vitest').vi.fn>).mockClear()

    useStore.getState().setActiveProject('proj-123')

    expect(electron.dbSetAppState).toHaveBeenCalledWith('activeProjectId', 'proj-123')
  })

  it('reorderTasks calls dbBatchUpsertTasks', async () => {
    (electron.dbBatchUpsertTasks as ReturnType<typeof import('vitest').vi.fn>).mockClear()

    await useStore.getState().addProject('P', '/tmp/p')
    const pid = useStore.getState().projects[0].id
    const t1 = useStore.getState().addTask(pid, 'A', 'todo')
    const t2 = useStore.getState().addTask(pid, 'B', 'todo');
    (electron.dbBatchUpsertTasks as ReturnType<typeof import('vitest').vi.fn>).mockClear()

    useStore.getState().reorderTasks('todo', [t2.id, t1.id])

    expect(electron.dbBatchUpsertTasks).toHaveBeenCalledTimes(1)
    const batchArg = (electron.dbBatchUpsertTasks as ReturnType<typeof import('vitest').vi.fn>).mock.calls[0][0]
    expect(batchArg).toHaveLength(2)
  })
})
