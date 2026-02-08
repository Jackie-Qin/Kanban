// Typed event bus for cross-panel communication
// Replaces untyped window.dispatchEvent(new CustomEvent(...)) pattern

type EventMap = {
  'editor:open-file': {
    path?: string
    filePath?: string
    preview?: boolean
    showDiff?: boolean
    projectPath?: string
    relativePath?: string
    line?: number
  }
  'panel:focus': { panelId: string }
  'workspace:open-file': { filePath: string; line?: number }
}

type Handler<T> = (data: T) => void

const listeners = new Map<string, Set<Handler<unknown>>>()

export const eventBus = {
  on<K extends keyof EventMap>(event: K, handler: Handler<EventMap[K]>): () => void {
    if (!listeners.has(event)) {
      listeners.set(event, new Set())
    }
    listeners.get(event)!.add(handler as Handler<unknown>)
    // Return cleanup function
    return () => {
      listeners.get(event)?.delete(handler as Handler<unknown>)
    }
  },

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    const handlers = listeners.get(event)
    if (handlers) {
      handlers.forEach((handler) => handler(data))
    }
  }
}
