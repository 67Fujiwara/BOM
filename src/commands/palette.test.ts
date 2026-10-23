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
  it('common words pick the intended command first', () => {
    useStore.setState({ ws: { ...useStore.getState().ws, user: { role: 'design', name: 'テスト' } } })
    const cases: Array<[string, string]> = [
      ['直す', 'issue.quickfix'],
      ['採用', 'adopt.best'],
      ['JSONを書き出す', 'data.exportJson'],
      ['新規', 'project.new'],
      ['提出', 'publish'],
      ['エクスポート', 'export.excel'],
      ['案件を開く', 'project.switch'],
      ['やり直し', 'redo'],
    ]
    const wrong = cases.filter(([q, id]) => paletteItems(q)[0]?.id !== id).map(([q, id]) => `${q} → ${paletteItems(q)[0]?.id} (want ${id})`)
    expect(wrong).toEqual([])
  })
  it('row actions typed as displayed are found (V4-11)', () => {
    useStore.setState({ ws: { ...useStore.getState().ws, user: { role: 'design', name: 'テスト' } } })
    expect(paletteItems('R040 を置換')[0]?.id).toBe('row.replace:R040')
    expect(paletteItems('R040 へジャンプ')[0]?.id).toBe('goto:R040')
  })
})
