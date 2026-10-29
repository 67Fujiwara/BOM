import { describe, expect, it } from 'vitest'
import { parsePanelStudioBom } from './panelStudio'

const good = {
  format: 'panel-studio/bom',
  version: 1,
  job: { company: '〇〇株式会社', jobNo: 'A123456', owner: '山田', completedAt: '2026-10-29', note: '' },
  deviceName: '検査装置 1号機',
  lines: [
    { model: 'MY4N-D2 DC24V', maker: 'オムロン', name: 'リレー', qty: 4, unit: '個', source: 'device' },
    { model: 'TS35 （必要長 1200mm）', maker: '', name: 'DINレール', qty: 2, unit: '本', source: 'derived' },
    { model: '', maker: '', name: '', qty: 3, unit: '個' },
    { model: 'X', qty: 0 },
  ],
}

describe('parsePanelStudioBom', () => {
  it('読める行だけ取り込み、読めない行は数える', () => {
    const r = parsePanelStudioBom(JSON.stringify(good))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data).toMatchObject({ jobNo: 'A123456', company: '〇〇株式会社', deviceName: '検査装置 1号機', skipped: 2 })
    expect(r.data.lines).toHaveLength(2)
    expect(r.data.lines[1]).toMatchObject({ derived: true, unit: '本' })
  })
  it('知らない単位は「個」にする', () => {
    const r = parsePanelStudioBom(JSON.stringify({ ...good, lines: [{ model: 'A', name: 'a', qty: 1, unit: 'ロール' }] }))
    expect(r.ok && r.data.lines[0].unit).toBe('個')
  })
  it('Panel Studio の実際の出力（但し書き付きの単位・メーカー「—」）を読む', () => {
    const r = parsePanelStudioBom(JSON.stringify({ ...good, lines: [{ model: 'DINレール TH35-7.5（切断 計420mm / 1本）', key: 'TH35-7.5', maker: '—', name: 'DINレール', qty: 1, unit: '本(1000mm定尺)', source: 'derived' }] }))
    expect(r.ok && r.data.lines[0]).toMatchObject({ unit: '本', maker: '', derived: true })
  })
  it('別の形式・壊れた JSON・空は理由つきで断る', () => {
    expect(parsePanelStudioBom('{')).toMatchObject({ ok: false })
    expect(parsePanelStudioBom(JSON.stringify({ format: 'panel-studio/electracad-sheets' }))).toMatchObject({ ok: false, error: expect.stringContaining('_bom.json') })
    expect(parsePanelStudioBom(JSON.stringify({ ...good, version: 2 }))).toMatchObject({ ok: false })
    expect(parsePanelStudioBom(JSON.stringify({ ...good, lines: [] }))).toMatchObject({ ok: false })
  })
})
