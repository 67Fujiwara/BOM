// 04 の深掘り: 誤判定のとき、どの行のどの値が変わったか（別の行への書き込み）/ f→1 で編集欄が出ない
import { launch, fresh, goto, toColKey, cursor, mode, sleep, dumpErrors, save, proj, closeAll, toastNow, storeState, cursorVisible, shot } from './lib.mjs'
const { browser, page, errors } = await launch()
const out = []
const D = 45
async function typeSeq(seq) { for (const ch of seq) { if (/[A-Z]/.test(ch)) await page.keyboard.press('Shift+' + ch); else await page.keyboard.press(ch); await sleep(D) } }
const flat = (p) => Object.fromEntries(p.rows.flatMap((r) => ['name', 'model', 'maker', 'altPolicy', 'unit'].map((k) => [r.id + '.' + k, r.working?.[k] ?? r[k]])).concat(p.rows.map((r) => [r.id + '.adopted', r.adoptedSupplierId ?? null]), p.rows.map((r) => [r.id + '.status', r.status])))
for (const [col, text] of [['name', 'knob'], ['maker', 'jst'], ['name', 'nand'], ['name', 'ssr'], ['model', 'NJM2904'], ['maker', 'JST'], ['model', 'STM32F103'], ['model', 'DRV8833'], ['model', 'ADP3338'], ['altPolicy', 'ka'], ['model', '2SC1815']]) {
  await fresh(page)
  await page.keyboard.press('1'); await goto(page, 'R040'); await toColKey(page, col)
  const before = flat(await proj(page))
  await typeSeq(text); await sleep(400)
  if ((await mode(page)) === '編集') { await page.keyboard.press('Enter'); await sleep(40) }
  await closeAll(page)
  const p = await proj(page)
  const after = flat(p)
  const diff = Object.keys({ ...before, ...after }).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k])).map((k) => `${k}: ${JSON.stringify(before[k])} → ${JSON.stringify(after[k])}`)
  out.push({ col, text, changes: diff, rowsAdded: p.rows.length - 80 })
  console.log(col, text, JSON.stringify(diff))
}
// f → 1（60ms）の後の編集欄
{
  await fresh(page)
  await page.keyboard.press('1'); await goto(page, 'R040'); await toColKey(page, 'name')
  await page.keyboard.press('f'); await sleep(60); await page.keyboard.press('1'); await sleep(300)
  const st = await storeState(page, (s) => ({ mode: s.mode, editValue: s.editValue, cursorRow: s.cursorRow, cellFilter: s.cellFilter }))
  const editor = await page.getByTestId('cell-editor').count()
  const vis = await cursorVisible(page)
  await shot(page, '04b-f1-no-editor')
  await page.keyboard.type('XYZ'); await sleep(50)
  const st2 = await storeState(page, (s) => ({ mode: s.mode, editValue: s.editValue }))
  await page.keyboard.press('Enter'); await sleep(50)
  const r = (await proj(page)).rows.find((x) => x.id === 'R040')
  out.push({ case: 'f then 1', st, editorInDom: editor, vis, afterTyping: st2, savedName: r.working?.name ?? r.name, active: await page.evaluate(() => document.activeElement?.className) })
  console.log('f1', JSON.stringify(out.at(-1)))
}
save('04b-burst-rows.json', out)
dumpErrors(errors, '04b')
await browser.close()
