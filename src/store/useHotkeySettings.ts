import { create } from 'zustand'
import { electron } from '../lib/electron'
import {
  KeyBinding,
  HOTKEY_ACTIONS,
  getDefaultBinding,
  matchesEvent as matchBinding
} from '../lib/hotkeys'

interface HotkeySettingsState {
  overrides: Record<string, KeyBinding>
  getBinding: (actionId: string) => KeyBinding
  setBinding: (actionId: string, binding: KeyBinding) => void
  resetBinding: (actionId: string) => void
  resetAll: () => void
  matchesEvent: (actionId: string, e: KeyboardEvent) => boolean
  matchesAnyAction: (e: KeyboardEvent) => string | null
  loadSettings: () => Promise<void>
}

function persist(overrides: Record<string, KeyBinding>) {
  electron.saveHotkeySettings(overrides)
}

export const useHotkeySettings = create<HotkeySettingsState>((set, get) => ({
  overrides: {},

  getBinding: (actionId: string) => {
    return get().overrides[actionId] || getDefaultBinding(actionId)
  },

  setBinding: (actionId: string, binding: KeyBinding) => {
    const newOverrides = { ...get().overrides, [actionId]: binding }
    set({ overrides: newOverrides })
    persist(newOverrides)
  },

  resetBinding: (actionId: string) => {
    const newOverrides = { ...get().overrides }
    delete newOverrides[actionId]
    set({ overrides: newOverrides })
    persist(newOverrides)
  },

  resetAll: () => {
    set({ overrides: {} })
    persist({})
  },

  matchesEvent: (actionId: string, e: KeyboardEvent) => {
    const binding = get().getBinding(actionId)
    return matchBinding(binding, e)
  },

  matchesAnyAction: (e: KeyboardEvent) => {
    const state = get()
    for (const action of HOTKEY_ACTIONS) {
      const binding = state.overrides[action.id] || getDefaultBinding(action.id)
      if (matchBinding(binding, e)) return action.id
    }
    return null
  },

  loadSettings: async () => {
    const overrides = await electron.getHotkeySettings()
    if (overrides) {
      set({ overrides })
    }
  },
}))
