import { useEffect } from 'react'
import { eventBus } from '../lib/eventBus'
import { electron } from '../lib/electron'
import { playNotificationSound } from '../lib/notificationSounds'
import { useNotificationSettings } from '../store/useNotificationSettings'

export default function TerminalNotification() {
  useEffect(() => {
    return eventBus.on('terminal:activity-done', ({ terminalName, projectName }) => {
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
