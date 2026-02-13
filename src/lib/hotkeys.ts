// Hotkey action definitions, defaults, and utilities

export interface KeyBinding {
  key: string
  meta?: boolean
  shift?: boolean
  alt?: boolean
  ctrl?: boolean
}

export interface HotkeyAction {
  id: string
  label: string
  category: 'general' | 'terminal' | 'editor'
  defaultBinding: KeyBinding
}

export const HOTKEY_ACTIONS: HotkeyAction[] = [
  { id: 'file-search', label: 'File search', category: 'general', defaultBinding: { key: 'p', meta: true } },
  { id: 'text-search', label: 'Text search', category: 'general', defaultBinding: { key: 'f', meta: true, shift: true } },
  { id: 'switch-project-left', label: 'Previous project', category: 'general', defaultBinding: { key: 'ArrowLeft', meta: true } },
  { id: 'switch-project-right', label: 'Next project', category: 'general', defaultBinding: { key: 'ArrowRight', meta: true } },
  { id: 'new-terminal', label: 'New terminal tab', category: 'terminal', defaultBinding: { key: 't', meta: true } },
  { id: 'clear-terminal', label: 'Clear terminal', category: 'terminal', defaultBinding: { key: 'k', meta: true } },
  { id: 'find-in-terminal', label: 'Find in terminal', category: 'terminal', defaultBinding: { key: 'f', meta: true } },
  { id: 'terminal-1', label: 'Terminal 1', category: 'terminal', defaultBinding: { key: '1', meta: true } },
  { id: 'terminal-2', label: 'Terminal 2', category: 'terminal', defaultBinding: { key: '2', meta: true } },
  { id: 'terminal-3', label: 'Terminal 3', category: 'terminal', defaultBinding: { key: '3', meta: true } },
  { id: 'save-file', label: 'Save file', category: 'editor', defaultBinding: { key: 's', meta: true } },
  { id: 'close-tab', label: 'Close editor tab', category: 'editor', defaultBinding: { key: 'w', meta: true } },
]

const DEFAULTS_MAP: Record<string, KeyBinding> = Object.fromEntries(
  HOTKEY_ACTIONS.map(a => [a.id, a.defaultBinding])
)

export function getDefaultBinding(actionId: string): KeyBinding {
  return DEFAULTS_MAP[actionId]
}

/** Check if a KeyboardEvent matches a KeyBinding */
export function matchesEvent(binding: KeyBinding, e: KeyboardEvent): boolean {
  // Normalize single-char keys to lowercase for case-insensitive comparison
  const bKey = binding.key.length === 1 ? binding.key.toLowerCase() : binding.key
  const eKey = e.key.length === 1 ? e.key.toLowerCase() : e.key
  if (bKey !== eKey) return false
  if (!!binding.meta !== e.metaKey) return false
  if (!!binding.shift !== e.shiftKey) return false
  if (!!binding.alt !== e.altKey) return false
  if (!!binding.ctrl !== e.ctrlKey) return false
  return true
}

/** Check if two bindings are equal */
export function bindingsEqual(a: KeyBinding, b: KeyBinding): boolean {
  const aKey = a.key.length === 1 ? a.key.toLowerCase() : a.key
  const bKey = b.key.length === 1 ? b.key.toLowerCase() : b.key
  return aKey === bKey && !!a.meta === !!b.meta && !!a.shift === !!b.shift && !!a.alt === !!b.alt && !!a.ctrl === !!b.ctrl
}

/** Format a binding for display: "⌘ ⇧ F" */
export function formatBinding(binding: KeyBinding): string {
  const parts: string[] = []
  if (binding.ctrl) parts.push('⌃')
  if (binding.alt) parts.push('⌥')
  if (binding.shift) parts.push('⇧')
  if (binding.meta) parts.push('⌘')

  const keyMap: Record<string, string> = {
    'ArrowLeft': '←',
    'ArrowRight': '→',
    'ArrowUp': '↑',
    'ArrowDown': '↓',
    'Enter': '↵',
    'Escape': 'Esc',
    'Backspace': '⌫',
    'Delete': '⌦',
    'Tab': '⇥',
    ' ': 'Space',
  }
  const displayKey = keyMap[binding.key] || binding.key.toUpperCase()
  parts.push(displayKey)

  return parts.join(' ')
}
