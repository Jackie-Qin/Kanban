import { vi } from 'vitest'

// Mock the electron API for renderer-side tests
const mockElectron = {
  loadData: vi.fn().mockResolvedValue({
    projects: [],
    tasks: [],
    labels: [],
    activeProjectId: null,
    closedProjectIds: [],
    layouts: {}
  }),
  deleteTerminalState: vi.fn(),
  deleteTerminalBuffers: vi.fn(),
  deleteTaskAttachments: vi.fn(),
  // Targeted database operations
  dbSaveLayout: vi.fn().mockResolvedValue(true),
  dbSetAppState: vi.fn().mockResolvedValue(true),
  dbUpsertProject: vi.fn().mockResolvedValue(true),
  dbDeleteProject: vi.fn().mockResolvedValue(true),
  dbUpsertTask: vi.fn().mockResolvedValue(true),
  dbDeleteTask: vi.fn().mockResolvedValue(true),
  dbBatchUpsertTasks: vi.fn().mockResolvedValue(true),
  dbUpsertLabel: vi.fn().mockResolvedValue(true),
  dbDeleteLabel: vi.fn().mockResolvedValue(true),
  dbBatchUpsertProjects: vi.fn().mockResolvedValue(true)
}

// Expose mock on window
Object.defineProperty(window, 'electronAPI', {
  value: mockElectron,
  writable: true
})

// Also mock the electron import path
vi.mock('../lib/electron', () => ({
  electron: mockElectron
}))
