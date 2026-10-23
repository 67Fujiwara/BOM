// ラウンド7: 速くなった重複チェック（行の並びごとの索引）が、編集・Undo / Redo・貼り付け・別タブの変更・行の削除のあとも正しいか
// 開発サーバーのモジュール（/src/model/rules.ts の checkRow）で、画面と同じストアの行を調べる
import { launch, fresh, goto, toColKey, sleep, storeState, toastNow, URL } from './lib.mjs'
import fs from 'node:fs'
const { browser, context, page, errors } = await launch()
const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 600)) }
const dups = () => page.evaluate(async () => {
  const s = (await import('/src/model/store.ts')).useStore.getState()
  const { checkRow } = await import('/src/model/rules.ts')
  const p = s.project()
  const res = {}
  for (const r of p.rows) { const d = checkRow(r, s.ws.rules, p).filter((x) => /dup/i.test(x.ruleId) || /重複/.test(x.message)).map((x) => x.field); if (d.length) res[r.id] = d.join(',') }
  // 正解（全行を素直に比べる）
  const eff = (r) => ({ ...r, ...(r.working ?? {}) })
  const truth = {}
  for (const r of p.rows) {
    if (['cancelled', 'replaced'].includes(r.status) || r.removal || r.pendingRemoval) continue
    for (const f of ['model', 'ref']) { const v = String(eff(r)[f] ?? ''); if (v && p.rows.some((o) => o.id !== r.id && !['cancelled', 'replaced'].includes(o.status) && !o.removal && !o.pendingRemoval && o.replaces !== r.id && r.replaces !== o.id && String(eff(o)[f] ?? '') === v)) truth[r.id] = (truth[r.id] ? truth[r.id] + ',' : '') + f }
  }
  return { app: res, truth }
})
const setVal = async (id, col, v) => { await goto(page, id); await toColKey(page, col); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type(v); await page.keyboard.press('Enter'); await sleep(80) }
await fresh(page)
const base = await dups(); log({ step: '起動', ...base })
const m40 = await storeState(page, (s) => { const r = s.project().rows.find((x) => x.id === 'R040'); return (r.working?.model ?? r.model) })
await setVal('R041', 'model', m40); log({ step: `R041 型式 := R040 の型式（${m40}）`, ...(await dups()) })
await page.keyboard.press('Control+z'); await sleep(80); log({ step: 'Ctrl+Z', ...(await dups()) })
await page.keyboard.press('Control+y'); await sleep(80); log({ step: 'Ctrl+Y', ...(await dups()) })
await setVal('R041', 'ref', 'K1'); await setVal('R042', 'ref', 'K1'); log({ step: '回路記号 K1 を 2 行', ...(await dups()) })
await goto(page, 'R042'); await page.keyboard.press('Shift+Delete'); await sleep(60); if (await page.evaluate(() => !!document.querySelector('[data-testid^="panel-"]'))) { await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter') } await sleep(80)
log({ step: 'R042 を削除', ...(await dups()) })
await page.keyboard.press('Control+z'); await sleep(80); log({ step: '削除を Ctrl+Z', ...(await dups()) })
// 別タブで R043 の型式を R040 と同じに
const B = await context.newPage(); await B.goto(URL); await B.waitForSelector('[data-testid="grid"]'); await B.locator('.gridwrap').focus()
await B.keyboard.press('Control+g'); await B.getByTestId('prompt-text').fill('R043'); await B.keyboard.press('Enter'); await B.keyboard.press('Home')
for (let i = 0; i < 40; i++) { if ((await B.getByTestId('cursor').textContent()).endsWith('型式')) break; await B.keyboard.press('ArrowRight') }
await B.keyboard.press('Enter'); await B.keyboard.press('Control+a'); await B.keyboard.type(m40); await B.keyboard.press('Enter'); await sleep(400)
await page.bringToFront(); await sleep(400)
log({ step: '別タブで R043 型式 := 同じ', ...(await dups()) })
// 複数セル貼り付け（R050〜R052 の型式に同じ値）
await goto(page, 'R050'); await toColKey(page, 'model')
await page.evaluate((v) => navigator.clipboard.writeText(`${v}\n${v}\n${v}`), 'DUP-PASTE-1')
await page.keyboard.press('Control+v'); await sleep(200)
log({ step: '貼り付けで R050〜R052 に同じ型式', toast: (await toastNow(page)).slice(0, 80), ...(await dups()) })
const mism = out.filter((o) => o.app && JSON.stringify(Object.keys(o.app).sort()) !== JSON.stringify(Object.keys(o.truth).sort()))
log({ mismatchSteps: mism.map((o) => o.step), errors: errors.slice(0, 5) })
fs.writeFileSync('/home/user/BOM/usertest/veteran/r7/77-dup.json', JSON.stringify(out, null, 2))
await browser.close()
