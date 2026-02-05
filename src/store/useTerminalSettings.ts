import { create } from 'zustand'
import { DEFAULT_FONT_SIZE, MIN_FONT_SIZE, MAX_FONT_SIZE, DEFAULT_FONT_FAMILY } from '../lib/terminalThemes'
import { electron } from '../lib/electron'

interface TerminalSettingsState {
  themeName: string
  fontSize: number
  fontFamily: string
  setTheme: (name: string) => void
  setFontSize: (size: number) => void
  setFontFamily: (family: string) => void
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
  loadSettings: () => Promise<void>
}

function persist(state: { themeName: string; fontSize: number; fontFamily: string }) {
  electron.saveTerminalSettings({
    terminalTheme: state.themeName,
    terminalFontSize: state.fontSize,
    terminalFontFamily: state.fontFamily,
  })
}

export const useTerminalSettings = create<TerminalSettingsState>((set, get) => ({
  themeName: 'Dark',
  fontSize: DEFAULT_FONT_SIZE,
  fontFamily: DEFAULT_FONT_FAMILY,

  setTheme: (name: string) => {
    set({ themeName: name })
    persist({ ...get(), themeName: name })
  },

  setFontSize: (size: number) => {
    const clamped = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, size))
    set({ fontSize: clamped })
    persist({ ...get(), fontSize: clamped })
  },

  setFontFamily: (family: string) => {
    set({ fontFamily: family })
    persist({ ...get(), fontFamily: family })
  },

  zoomIn: () => {
    const next = Math.min(get().fontSize + 1, MAX_FONT_SIZE)
    set({ fontSize: next })
    persist({ ...get(), fontSize: next })
  },

  zoomOut: () => {
    const next = Math.max(get().fontSize - 1, MIN_FONT_SIZE)
    set({ fontSize: next })
    persist({ ...get(), fontSize: next })
  },

  resetZoom: () => {
    set({ fontSize: DEFAULT_FONT_SIZE })
    persist({ ...get(), fontSize: DEFAULT_FONT_SIZE })
  },

  loadSettings: async () => {
    const settings = await electron.getTerminalSettings()
    if (settings) {
      set({
        themeName: settings.terminalTheme || 'Dark',
        fontSize: settings.terminalFontSize || DEFAULT_FONT_SIZE,
        fontFamily: settings.terminalFontFamily || DEFAULT_FONT_FAMILY,
      })
    }
  },
}))
