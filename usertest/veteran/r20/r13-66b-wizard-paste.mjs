// ラウンド13: ガイド「1 貼り付け」（Excel からコピーした表を欄に貼る）でも同じか（a1・c1・m6 相当の 300 行）
import { launch, fresh, palette, sleep, ws } from '../r8/rerun7/rerun6/lib.mjs'
import { saveJson } from './lib20.mjs'
import { SHAPES } from './r13-60-shapes.mjs'
const TAG = process.env.TAG ?? ''
const { browser, page, errors } = await launch({ launch: {} })
await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
const big = [['部品名', '型式', 'メーカ', '数量'], ...Array.from({ length: 300 }, (_, i) => (i === 120 ? ['部品取付板', '品番なし', 'メーカ不問', 1] : [`部品${i}`, `MDL-${i}`, 'オムロン', (i % 9) + 1]))]
const cases = [...SHAPES.filter((s) => ['a1-nashi-fumon', 'c1-oldnew-repeat', 'h3-new-qty-only-changed'].includes(s.id)), { id: 'big300-lookalike-at-120', rows: big }]
const out = []
for (const c of cases) {
  await fresh(page)
  await palette(page, '新しいBOM'); await sleep(40)
  await page.getByTestId('wizard-id').fill('P-W' + out.length); await page.keyboard.press('Enter')
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await sleep(20) }
  await page.keyboard.press('1'); await sleep(60)
  await page.evaluate((t) => navigator.clipboard.writeText(t), c.rows.map((r) => r.join('\t')).join('\n'))
  await page.getByTestId('wizard-paste').focus(); await page.keyboard.press('Control+v'); await sleep(150)
  await page.keyboard.press('Control+Enter'); await sleep(300)
  const prev = (await page.getByTestId('wizard-preview').textContent({ timeout: 3000 }).catch(() => '')) ?? ''
  await page.keyboard.press('Enter'); await page.waitForFunction(() => !document.querySelector('[data-testid="panel-wizard"]'), null, { timeout: 60000 }).catch(() => {})
  const w = await ws(page); const p = w?.projects.find((x) => x.id === w.currentProjectId)
  const rec = { id: c.id, preview: prev.slice(0, 500), rows: p?.rows.length, qty0: p?.rows.filter((r) => r.qtyNeeded === 0).length, sample: p?.rows.slice(0, 5).map((r) => [r.name, r.model, r.qtyNeeded].join(' / ')), tail: p?.rows.slice(-2).map((r) => [r.name, r.model, r.qtyNeeded].join(' / ')) }
  out.push(rec); console.log(JSON.stringify(rec).slice(0, 1400))
}
saveJson(`66b-wizard-paste${TAG}.json`, out)
await browser.close()
