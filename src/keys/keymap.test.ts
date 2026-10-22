import { describe, it, expect } from 'vitest'
import { eventToKey, lookupBinding, KEYMAP } from './keymap'

function ev(init: Partial<KeyboardEvent>): KeyboardEvent {
  const key = init.key ?? ''
  const code = init.code ?? (/^[a-zA-Z]$/.test(key) ? 'Key' + key.toUpperCase() : '')
  return { ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, key, code, ...init } as KeyboardEvent
}

describe('eventToKey', () => {
  it('normalizes modifiers', () => {
    expect(eventToKey(ev({ ctrlKey: true, shiftKey: true, key: 'Z' }))).toBe('Ctrl+Shift+Z')
    expect(eventToKey(ev({ ctrlKey: true, key: 'k' }))).toBe('Ctrl+K')
    expect(eventToKey(ev({ shiftKey: true, key: '?' }))).toBe('?')
    expect(eventToKey(ev({ shiftKey: true, key: 'A' }))).toBe('Shift+A')
    expect(eventToKey(ev({ altKey: true, key: 'ArrowUp' }))).toBe('Alt+ArrowUp')
    expect(eventToKey(ev({ key: ' ' }))).toBe(' ')
  })
  it('is stable under CapsLock and lowercase shifted letters', () => {
    expect(eventToKey(ev({ key: 'A', code: 'KeyA' }))).toBe('a') // CapsLock
    expect(eventToKey(ev({ key: 'c', code: 'KeyC', ctrlKey: true, shiftKey: true }))).toBe('Ctrl+Shift+C')
    expect(eventToKey(ev({ key: 'j', code: 'KeyJ', shiftKey: true }))).toBe('Shift+J')
    expect(eventToKey(ev({ key: 'ち', code: 'KeyA' }))).toBe('a') // かな入力
    expect(eventToKey(ev({ key: '?', code: 'Slash', shiftKey: true }))).toBe('?')
  })
})

describe('lookupBinding', () => {
  it('one-key bindings only fire in nav mode', () => {
    expect(lookupBinding('a', 'nav')?.id).toBe('adopt.best')
    expect(lookupBinding('a', 'edit')).toBeUndefined()
    expect(lookupBinding('1', 'edit')).toBeUndefined()
  })
  it('global bindings fire in any mode', () => {
    expect(lookupBinding('Ctrl+K', 'edit')?.id).toBe('palette.open')
    expect(lookupBinding('Ctrl+Z', 'edit')?.id).toBe('undo')
  })
  it('does not use browser-reserved keys', () => {
    const all = KEYMAP.flatMap((b) => b.keys)
    for (const k of ['Ctrl+W', 'Ctrl+T', 'Ctrl+N', 'Ctrl+Tab', 'Ctrl+D']) expect(all).not.toContain(k)
  })
})
