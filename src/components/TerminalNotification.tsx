import { useEffect } from 'react'
import { eventBus } from '../lib/eventBus'
import { electron } from '../lib/electron'
import { playNotificationSound } from '../lib/notificationSounds'
import { useNotificationSettings } from '../store/useNotificationSettings'
import { useStore } from '../store/useStore'

export default function TerminalNotification() {
  useEffect(() => {
    return eventBus.on('terminal:activity-done', ({ terminalName, projectName, projectPath }) => {
      // Skip notification if the user is viewing this project
      const { activeProjectId, projects } = useStore.getState()
      const activeProject = projects.find(p => p.id === activeProjectId)
      if (activeProject && activeProject.path === projectPath) return

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
