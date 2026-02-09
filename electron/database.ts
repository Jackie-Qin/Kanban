import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { DATA_DIR, DATA_FILE, ensureDataDir } from './shared'

const DB_FILE = path.join(DATA_DIR, 'kanban.db')

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized — call initDatabase() first')
  }
  return db
}

export function initDatabase() {
  ensureDataDir()

  db = new Database(DB_FILE)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      "order" INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      "column" TEXT NOT NULL DEFAULT 'todo',
      labels TEXT NOT NULL DEFAULT '[]',
      dueDate TEXT,
      createdAt TEXT NOT NULL,
      "order" INTEGER NOT NULL DEFAULT 0,
      branch TEXT,
      archived INTEGER NOT NULL DEFAULT 0,
      attachments TEXT NOT NULL DEFAULT '[]',
      FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS labels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS layouts (
      projectId TEXT PRIMARY KEY,
      layout TEXT
    );
  `)

  // Initialize schema version if empty
  const versionRow = db.prepare('SELECT version FROM schema_version').get() as { version: number } | undefined
  if (!versionRow) {
    db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(1)
  }

  // Schema migration v2: add UNIQUE constraint on projects.path
  const currentVersion = (db.prepare('SELECT version FROM schema_version').get() as { version: number }).version
  if (currentVersion < 2) {
    db.transaction(() => {
      // Check if the unique index already exists
      const idx = db!.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='projects_path_unique'").get()
      if (!idx) {
        db!.exec('CREATE UNIQUE INDEX projects_path_unique ON projects(path)')
      }
      db!.prepare('UPDATE schema_version SET version = 2').run()
    })()
  }

  // Migrate from data.json if database is empty and data.json exists
  const projectCount = (db.prepare('SELECT COUNT(*) as count FROM projects').get() as { count: number }).count
  if (projectCount === 0 && fs.existsSync(DATA_FILE)) {
    migrateFromJson()
  }

  // Seed default labels if empty
  const labelCount = (db.prepare('SELECT COUNT(*) as count FROM labels').get() as { count: number }).count
  if (labelCount === 0 && projectCount === 0) {
    const insertLabel = db.prepare('INSERT OR IGNORE INTO labels (id, name, color) VALUES (?, ?, ?)')
    insertLabel.run('bug', 'Bug', '#ef4444')
    insertLabel.run('feature', 'Feature', '#22c55e')
    insertLabel.run('urgent', 'Urgent', '#f97316')
    insertLabel.run('improvement', 'Improvement', '#3b82f6')
  }
}

function migrateFromJson() {
  if (!db) return

  try {
    const content = fs.readFileSync(DATA_FILE, 'utf-8')
    const data = JSON.parse(content)
    console.log('Migrating data.json to SQLite...')

    const transaction = db.transaction(() => {
      // Projects
      const insertProject = db!.prepare('INSERT OR IGNORE INTO projects (id, name, path, "order") VALUES (?, ?, ?, ?)')
      for (const p of data.projects || []) {
        insertProject.run(p.id, p.name, p.path, p.order ?? 0)
      }

      // Tasks
      const insertTask = db!.prepare(`INSERT OR IGNORE INTO tasks (id, projectId, title, description, "column", labels, dueDate, createdAt, "order", branch, archived, attachments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      for (const t of data.tasks || []) {
        insertTask.run(
          t.id, t.projectId, t.title, t.description || '',
          t.column, JSON.stringify(t.labels || []),
          t.dueDate || null, t.createdAt,
          t.order ?? 0, t.branch || null,
          t.archived ? 1 : 0,
          JSON.stringify(t.attachments || [])
        )
      }

      // Labels
      const insertLabel = db!.prepare('INSERT OR IGNORE INTO labels (id, name, color) VALUES (?, ?, ?)')
      for (const l of data.labels || []) {
        insertLabel.run(l.id, l.name, l.color)
      }

      // App state
      const insertState = db!.prepare('INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)')
      if (data.activeProjectId) {
        insertState.run('activeProjectId', data.activeProjectId)
      }
      if (data.closedProjectIds) {
        insertState.run('closedProjectIds', JSON.stringify(data.closedProjectIds))
      }

      // Layouts
      const insertLayout = db!.prepare('INSERT OR REPLACE INTO layouts (projectId, layout) VALUES (?, ?)')
      if (data.layouts) {
        for (const [projectId, layout] of Object.entries(data.layouts)) {
          insertLayout.run(projectId, JSON.stringify(layout))
        }
      }
    })

    transaction()

    // Rename old file as backup
    const backupPath = DATA_FILE + '.backup'
    if (!fs.existsSync(backupPath)) {
      fs.renameSync(DATA_FILE, backupPath)
      console.log(`Migration complete. Old data backed up to ${backupPath}`)
    } else {
      console.log('Migration complete. Backup already exists, keeping data.json in place.')
    }
  } catch (error) {
    console.error('Failed to migrate from data.json:', error)
  }
}

export function closeDatabase() {
  if (db) {
    db.close()
    db = null
  }
}

// --- Query helpers ---

export function getAllProjects() {
  return getDb().prepare('SELECT id, name, path, "order" FROM projects ORDER BY "order"').all()
}

export function getProjectByPath(path: string) {
  return getDb().prepare('SELECT id, name, path, "order" FROM projects WHERE path = ?').get(path) as { id: string; name: string; path: string; order: number } | undefined
}

export function upsertProject(project: { id: string; name: string; path: string; order: number }) {
  getDb().prepare('INSERT OR REPLACE INTO projects (id, name, path, "order") VALUES (?, ?, ?, ?)').run(project.id, project.name, project.path, project.order)
}

export function deleteProject(id: string) {
  getDb().prepare('DELETE FROM projects WHERE id = ?').run(id)
  getDb().prepare('DELETE FROM layouts WHERE projectId = ?').run(id)
  getDb().prepare('DELETE FROM app_state WHERE key = ? AND value = ?').run('activeProjectId', id)
}

export function getAllTasks() {
  const rows = getDb().prepare('SELECT * FROM tasks').all() as Array<Record<string, unknown>>
  return rows.map(deserializeTask)
}

export function getTasksByProject(projectId: string) {
  const rows = getDb().prepare('SELECT * FROM tasks WHERE projectId = ?').all(projectId) as Array<Record<string, unknown>>
  return rows.map(deserializeTask)
}

export function upsertTask(task: {
  id: string; projectId: string; title: string; description: string;
  column: string; labels: string[]; dueDate: string | null; createdAt: string;
  order: number; branch?: string; archived?: boolean; attachments?: unknown[]
}) {
  getDb().prepare(`INSERT OR REPLACE INTO tasks (id, projectId, title, description, "column", labels, dueDate, createdAt, "order", branch, archived, attachments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    task.id, task.projectId, task.title, task.description,
    task.column, JSON.stringify(task.labels),
    task.dueDate, task.createdAt,
    task.order, task.branch || null,
    task.archived ? 1 : 0,
    JSON.stringify(task.attachments || [])
  )
}

export function deleteTask(id: string) {
  getDb().prepare('DELETE FROM tasks WHERE id = ?').run(id)
}

export function deleteTasksByProject(projectId: string) {
  getDb().prepare('DELETE FROM tasks WHERE projectId = ?').run(projectId)
}

export function getAllLabels() {
  return getDb().prepare('SELECT * FROM labels').all()
}

export function upsertLabel(label: { id: string; name: string; color: string }) {
  getDb().prepare('INSERT OR REPLACE INTO labels (id, name, color) VALUES (?, ?, ?)').run(label.id, label.name, label.color)
}

export function deleteLabel(id: string) {
  getDb().prepare('DELETE FROM labels WHERE id = ?').run(id)
  // Strip label from tasks
  const tasks = getDb().prepare('SELECT id, labels FROM tasks').all() as Array<{ id: string; labels: string }>
  const update = getDb().prepare('UPDATE tasks SET labels = ? WHERE id = ?')
  for (const task of tasks) {
    const labels: string[] = JSON.parse(task.labels)
    if (labels.includes(id)) {
      update.run(JSON.stringify(labels.filter(l => l !== id)), task.id)
    }
  }
}

export function getAppState(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM app_state WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function setAppState(key: string, value: string | null) {
  if (value === null) {
    getDb().prepare('DELETE FROM app_state WHERE key = ?').run(key)
  } else {
    getDb().prepare('INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)').run(key, value)
  }
}

export function getLayout(projectId: string): unknown | null {
  const row = getDb().prepare('SELECT layout FROM layouts WHERE projectId = ?').get(projectId) as { layout: string } | undefined
  if (!row) return null
  try { return JSON.parse(row.layout) } catch { return null }
}

export function saveLayout(projectId: string, layout: unknown) {
  if (layout === null || layout === undefined) {
    getDb().prepare('DELETE FROM layouts WHERE projectId = ?').run(projectId)
  } else {
    getDb().prepare('INSERT OR REPLACE INTO layouts (projectId, layout) VALUES (?, ?)').run(projectId, JSON.stringify(layout))
  }
}

export function getAllLayouts(): Record<string, unknown> {
  const rows = getDb().prepare('SELECT projectId, layout FROM layouts').all() as Array<{ projectId: string; layout: string }>
  const result: Record<string, unknown> = {}
  for (const row of rows) {
    try { result[row.projectId] = JSON.parse(row.layout) } catch { /* skip */ }
  }
  return result
}

// -- Batch helpers (wrap multiple upserts in a single transaction) --

export function batchUpsertProjects(projects: Array<{ id: string; name: string; path: string; order: number }>) {
  const d = getDb()
  const stmt = d.prepare('INSERT OR REPLACE INTO projects (id, name, path, "order") VALUES (?, ?, ?, ?)')
  const tx = d.transaction(() => {
    for (const p of projects) {
      stmt.run(p.id, p.name, p.path, p.order)
    }
  })
  tx()
}

export function batchUpsertTasks(tasks: Array<{
  id: string; projectId: string; title: string; description: string;
  column: string; labels: string[]; dueDate: string | null; createdAt: string;
  order: number; branch?: string; archived?: boolean; attachments?: unknown[]
}>) {
  const d = getDb()
  const stmt = d.prepare(`INSERT OR REPLACE INTO tasks (id, projectId, title, description, "column", labels, dueDate, createdAt, "order", branch, archived, attachments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const tx = d.transaction(() => {
    for (const t of tasks) {
      stmt.run(t.id, t.projectId, t.title, t.description, t.column, JSON.stringify(t.labels), t.dueDate, t.createdAt, t.order, t.branch || null, t.archived ? 1 : 0, JSON.stringify(t.attachments || []))
    }
  })
  tx()
}

// -- Full load (still needed for initial data load) --

export function loadAllData() {
  const projects = getAllProjects()
  const tasks = getAllTasks()
  const labels = getAllLabels()
  const activeProjectId = getAppState('activeProjectId')
  const closedProjectIdsStr = getAppState('closedProjectIds')
  const closedProjectIds = closedProjectIdsStr ? JSON.parse(closedProjectIdsStr) : []
  const layouts = getAllLayouts()

  return { projects, tasks, labels, activeProjectId, closedProjectIds, layouts }
}

// -- Deserialize helpers --

function deserializeTask(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    projectId: row.projectId as string,
    title: row.title as string,
    description: row.description as string,
    column: row.column as string,
    labels: JSON.parse(row.labels as string || '[]'),
    dueDate: row.dueDate as string | null,
    createdAt: row.createdAt as string,
    order: row.order as number,
    branch: row.branch as string | undefined,
    archived: (row.archived as number) === 1 ? true : undefined,
    attachments: JSON.parse(row.attachments as string || '[]')
  }
}
