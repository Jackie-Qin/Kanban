import { create } from 'zustand'
import { electron } from '../lib/electron'

interface NotificationSettingsState {
  soundEnabled: boolean
  sound: string
  setSoundEnabled: (enabled: boolean) => void
  setSound: (sound: string) => void
  loadSettings: () => Promise<void>
}

export const useNotificationSettings = create<NotificationSettingsState>((set) => ({
  soundEnabled: true,
  sound: 'chime',

  setSoundEnabled: (enabled: boolean) => {
    set({ soundEnabled: enabled })
    electron.saveNotificationSettings({ soundEnabled: enabled })
  },

  setSound: (sound: string) => {
    set({ sound })
    electron.saveNotificationSettings({ sound })
  },

  loadSettings: async () => {
    const settings = await electron.getNotificationSettings()
    if (settings) {
      set({
        soundEnabled: settings.soundEnabled,
        sound: settings.sound,
      })
    }
  },
}))
