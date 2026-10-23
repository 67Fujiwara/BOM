import { describe, expect, it } from 'vitest'
import { STATIC, paletteItems } from './registry'
import { KEYMAP } from '@/keys/keymap'
import { useStore } from '@/model/store'
import type { Role } from '@/model/types'

// 操作名どおりに打って Enter したら、その操作が先頭に来ること（別の操作が走らない）
describe('palette ranking', () => {
  for (const role of ['design', 'purchasing', 'pm'] as Role[]) {
    it(`exact labels come first (${role})`, () => {
      useStore.setState({ ws: { ...useStore.getState().ws, user: { role, name: 'テスト' } } })
      const wrong: string[] = []
      const labels = [...STATIC.map((c) => [c.id, c.label]), ...KEYMAP.map((b) => [b.id, b.label])]
      for (const [id, label] of labels) {
        const top = paletteItems(label)[0]
        if (!top || (top.id !== id && top.label !== label)) wrong.push(`${label} → ${top?.label ?? 'なし'}`)
      }
      expect(wrong).toEqual([])
    })
  }
})
