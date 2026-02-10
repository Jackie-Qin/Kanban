import { useEffect, useState, useCallback, useRef } from 'react'
import { eventBus } from '../lib/eventBus'
import { electron } from '../lib/electron'
import { playNotificationSound } from '../lib/notificationSounds'
import { useNotificationSettings } from '../store/useNotificationSettings'

interface Notification {
  id: number
  projectName: string
  terminalName: string
  fading: boolean
}

const DISPLAY_MS = 4000
const FADE_MS = 300

export default function TerminalNotification() {
  const [notifications, setNotifications] = useState<Notification[]>()
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: number) => {
    // Start fade
    setNotifications(prev => prev?.map(n => n.id === id ? { ...n, fading: true } : n))
    const fadeTimer = setTimeout(() => {
      setNotifications(prev => prev?.filter(n => n.id !== id))
      timersRef.current.delete(id)
    }, FADE_MS)
    timersRef.current.set(id, fadeTimer)
  }, [])

  useEffect(() => {
    return eventBus.on('terminal:activity-done', ({ terminalName, projectName }) => {
      const { soundEnabled, sound } = useNotificationSettings.getState()
      if (soundEnabled) {
        playNotificationSound(sound)
      }
      const id = Date.now()
      setNotifications(prev => [...(prev || []), { id, projectName, terminalName, fading: false }])

      const timer = setTimeout(() => dismiss(id), DISPLAY_MS)
      timersRef.current.set(id, timer)

      // Send OS-level system notification
      electron.showSystemNotification({
        title: `${projectName} · ${terminalName} done`,
        body: 'Terminal task completed'
      })
    })
  }, [dismiss])

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach(t => clearTimeout(t))
    }
  }, [])

  if (!notifications?.length) return null

  return (
    <div className="fixed top-12 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {notifications.map(n => (
        <div
          key={n.id}
          className="pointer-events-auto flex items-center gap-3 bg-[#1e1e1e] border border-dark-border rounded-lg pl-3 pr-2 py-2.5 shadow-lg cursor-pointer"
          style={{
            animation: n.fading ? `fadeOut ${FADE_MS}ms ease-out forwards` : 'slideIn 0.25s ease-out',
            minWidth: 220,
          }}
          onClick={() => dismiss(n.id)}
        >
          <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-dark-text truncate">
              <span className="text-dark-muted">{n.projectName}</span>
              <span className="text-dark-muted mx-1.5">·</span>
              {n.terminalName} done
            </p>
          </div>
          <button
            onClick={e => { e.stopPropagation(); dismiss(n.id) }}
            className="p-0.5 text-dark-muted hover:text-dark-text rounded transition-colors flex-shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
