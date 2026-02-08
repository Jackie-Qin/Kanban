import { describe, it, expect, vi } from 'vitest'
import { eventBus } from '../lib/eventBus'

describe('eventBus', () => {
  it('emits and receives events', () => {
    const handler = vi.fn()
    const cleanup = eventBus.on('panel:focus', handler)

    eventBus.emit('panel:focus', { panelId: 'editor' })

    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith({ panelId: 'editor' })
    cleanup()
  })

  it('cleanup function removes listener', () => {
    const handler = vi.fn()
    const cleanup = eventBus.on('panel:focus', handler)

    cleanup()
    eventBus.emit('panel:focus', { panelId: 'editor' })

    expect(handler).not.toHaveBeenCalled()
  })

  it('supports multiple listeners for the same event', () => {
    const handler1 = vi.fn()
    const handler2 = vi.fn()
    const c1 = eventBus.on('panel:focus', handler1)
    const c2 = eventBus.on('panel:focus', handler2)

    eventBus.emit('panel:focus', { panelId: 'git' })

    expect(handler1).toHaveBeenCalledWith({ panelId: 'git' })
    expect(handler2).toHaveBeenCalledWith({ panelId: 'git' })
    c1()
    c2()
  })

  it('does not call listeners for different events', () => {
    const handler = vi.fn()
    const cleanup = eventBus.on('panel:focus', handler)

    eventBus.emit('editor:open-file', { path: '/test.ts' })

    expect(handler).not.toHaveBeenCalled()
    cleanup()
  })

  it('passes typed data for editor:open-file', () => {
    const handler = vi.fn()
    const cleanup = eventBus.on('editor:open-file', handler)

    eventBus.emit('editor:open-file', {
      path: '/src/test.ts',
      preview: true,
      showDiff: false,
      line: 42
    })

    expect(handler).toHaveBeenCalledWith({
      path: '/src/test.ts',
      preview: true,
      showDiff: false,
      line: 42
    })
    cleanup()
  })

  it('passes typed data for workspace:open-file', () => {
    const handler = vi.fn()
    const cleanup = eventBus.on('workspace:open-file', handler)

    eventBus.emit('workspace:open-file', { filePath: '/test.ts', line: 10 })

    expect(handler).toHaveBeenCalledWith({ filePath: '/test.ts', line: 10 })
    cleanup()
  })
})
