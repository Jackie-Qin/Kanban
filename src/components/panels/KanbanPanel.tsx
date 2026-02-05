import { IDockviewPanelProps } from 'dockview'
import KanbanBoard from '../KanbanBoard'
import { Task } from '../../types'

interface KanbanPanelParams {
  projectId: string
  projectPath: string
  onTaskClick: (task: Task, isNew?: boolean) => void
}

export default function KanbanPanel({ params }: IDockviewPanelProps<KanbanPanelParams>) {
  const { projectId, projectPath, onTaskClick } = params

  return (
    <div className="h-full w-full overflow-hidden">
      <KanbanBoard
        projectId={projectId}
        projectPath={projectPath}
        onTaskClick={onTaskClick}
      />
    </div>
  )
}
