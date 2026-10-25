// ラウンド20: 直し方の候補（Ctrl+.）の選び方: 全角の「１」、テンキーの 1、Enter、↓Enter、Space、2（あとで）の動き。【削除？】の行で
import { launch, fresh, sleep, toastNow, ws, wizardCreate, panel, closeAll } from '../r8/rerun7/rerun6/lib.mjs'
import { saveJson } from './lib21.mjs'
const lines = ['部品名\t型式\t変更後型式\tメーカ\t数量']
for (let k = 1; k <= 12; k++) lines.push(`部品${k}\tOLD-${k}\t${k <= 6 ? `OLD-${k}` : k <= 8 ? `NEW-${k}` : ''}\tオムロン\t${(k % 7) + 1}`)
const { browser, page, errors } = await launch()
await fresh(page)
const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 500)) }
const snap = async () => { const w = await ws(page); const p = w.projects.find((x) => x.id === w.currentProjectId); return { rows: p.rows.length, flagged: p.rows.filter((x) => (x.note ?? '').startsWith('【削除？】')).length, deferred: p.rows.filter((x) => (x.deferredRules ?? []).length).length } }
await wizardCreate(page, 'P-DEL6', lines.join('\n'))
await page.keyboard.press('Escape')
const base = await snap()
log({ step: 'created', ...base })
for (const k of ['１', 'Process1', 'Numpad1', 'Digit1', 'Enter', 'ArrowDown+Enter', 'Space', '2', 'Numpad2', '２', 'Shift+1', 'Escape', 'ArrowUp+Enter']) {
  await page.keyboard.press('F8'); await sleep(40)
  await page.keyboard.press('Control+.'); await sleep(80)
  const p0 = await panel(page)
  const before = await snap()
  for (const part of k.split('+')) { if (k.includes('+') && !['ArrowDown', 'ArrowUp', 'Enter', 'Shift', '1'].includes(part)) {} }
  if (k === 'ArrowDown+Enter') { await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter') }
  else if (k === 'ArrowUp+Enter') { await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter') }
  else if (k === '１' || k === '２') await page.evaluate((key) => { const t = document.activeElement ?? document.body; t.dispatchEvent(new KeyboardEvent('keydown', { key, code: key === '１' ? 'Digit1' : 'Digit2', bubbles: true, cancelable: true })) }, k)
  else if (k === 'Process1') await page.evaluate(() => { const t = document.activeElement ?? document.body; t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Process', code: 'Digit1', keyCode: 229, isComposing: true, bubbles: true, cancelable: true })) })
  else await page.keyboard.press(k)
  await sleep(120)
  const after = await snap()
  log({ k, panelBefore: p0, panelAfter: await panel(page), flaggedBefore: before.flagged, flaggedAfter: after.flagged, deferredAfter: after.deferred, toast: (await toastNow(page)).slice(0, 100) })
  await closeAll(page)
}
saveJson(`167-quickfix-keys${process.env.RUN ?? ''}.json`, out)
console.log('errors', JSON.stringify(errors.filter((e) => e.type !== 'dialog').slice(0, 3)))
await browser.close()
