import { useEffect } from 'react'
import { eventBus } from '../lib/eventBus'
import { electron } from '../lib/electron'
import { playNotificationSound } from '../lib/notificationSounds'
import { useNotificationSettings } from '../store/useNotificationSettings'
import { useStore } from '../store/useStore'
import { useBadgeStore } from '../store/useBadgeStore'

export default function TerminalNotification() {
  useEffect(() => {
    return eventBus.on('terminal:activity-done', ({ terminalName, projectName, projectPath }) => {
      // Skip if the user is viewing this project
      const { activeProjectId, projects } = useStore.getState()
      const project = projects.find(p => p.path === projectPath)
      if (!project) return
      if (project.id === activeProjectId) return

      // Add red dot badges on project tab + terminal icon
      useBadgeStore.getState().addBadges(project.id)

      const { soundEnabled, sound } = useNotificationSettings.getState()
      if (soundEnabled) {
        playNotificationSound(sound)
      }

      electron.showSystemNotification({
        title: `${projectName} · ${terminalName} done`,
        body: 'Terminal task completed'
      })
    })
  }, [])

  return null
}
