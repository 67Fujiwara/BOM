// ラウンド18: Excel の手癖でまだ試していないキー（Ctrl+R 右へコピー・Ctrl+; 今日の日付・Ctrl+X 切り取り→Ctrl+V・Shift+Space 行選択・
// Ctrl+- 行削除・Ctrl+Shift++ 行挿入・Ctrl+B・Ctrl+1 書式・F4 繰り返し・Ctrl+H 置換・F5 ジャンプ・Ctrl+Shift+↓・Ctrl+N・Ctrl+W・
// 編集中の Alt+Enter（セル内改行）と Ctrl+Enter（確定して動かない））。ブラウザに渡る（既定の動作を止めない）キーも記録する
import { launch, fresh, T, makeLog, ui, sleep, shot, proj, sel, gotoCol, typeReal, clearToast } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 'r35_excel_keys18')
const step = async (name, fn) => { try { log('== ' + name); await fn() } catch (e) { log('EXC', name, String(e).slice(0, 300)) } }
await page.addInitScript(() => { window.__kd = []; window.addEventListener('keydown', (e) => { window.__kd.push(`${e.ctrlKey ? 'C+' : ''}${e.shiftKey ? 'S+' : ''}${e.altKey ? 'A+' : ''}${e.key}:${e.defaultPrevented ? 'prevented' : 'browser'}`) }) })
const kd = async () => { const v = await page.evaluate(() => { const x = window.__kd.slice(); window.__kd.length = 0; return x }); return v.join(',') }
const state = async () => { const u = await ui(page); return `mode=${u.mode} cur=${u.cursorRow}/${u.cursorCol} edit=${JSON.stringify(u.editValue)} panel=${u.panel} view=${u.view}` }
const rowv = async (id) => { const r = (await proj(page)).rows.find((x) => x.id === id); return r ? `${id}{name=${r.name} model=${r.model} qty=${r.qtyNeeded} need=${r.needDate ?? '-'} working=${JSON.stringify(r.working ?? null)} status=${r.status} hidden=${!!r.hidden}}` : `${id}:なし` }
async function press(k, id) {
  await clearToast(page)
  const n0 = (await proj(page)).rows.length
  await page.keyboard.press(k); await sleep(250)
  const n1 = (await proj(page)).rows.length
  log(`  [${k}] keys=${await kd()} | ${await state()} | toast=${(await T.toast(page))?.slice(0, 160)} | panel=${((await T.panelText(page)) ?? '-').slice(0, 120)} | rows ${n0}→${n1}${id ? ' | ' + (await rowv(id)) : ''}`)
  if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(100) }
}
await step('A 設計: R005 の型式で Excel のキー（表の上）', async () => {
  await fresh(page); await sleep(150)
  await sel(page, 'R005'); await gotoCol(page, '型式'); await kd()
  for (const k of ['Control+r', 'Control+;', 'Shift+Space', 'Control+Space', 'Control+-', 'Control+Shift+=', 'Control+b', 'Control+1', 'F4', 'Control+h', 'F5', 'Control+Shift+ArrowDown', 'Control+n', 'Control+w', 'Control+Tab']) await press(k, 'R005')
})
await step('B 設計: R003 の部品名を Ctrl+C（前の作業）→ R005 の型式で Ctrl+X → R006 の型式で Ctrl+V（切り取って移すつもり）', async () => {
  await fresh(page); await sleep(150)
  await sel(page, 'R003'); await gotoCol(page, '部品名'); await page.keyboard.press('Control+c'); await sleep(200); log(`  Ctrl+C on R003 部品名: toast=${await T.toast(page)}`)
  await sel(page, 'R005'); await gotoCol(page, '型式'); await kd()
  await press('Control+x', 'R005')
  await sel(page, 'R006'); await gotoCol(page, '型式'); await kd()
  await page.keyboard.press('Control+v'); await sleep(300)
  log(`  [Control+v] keys=${await kd()} | ${await state()} | toast=${(await T.toast(page))?.slice(0, 160)} | ${await rowv('R005')} | ${await rowv('R006')}`)
})
await step('C 設計: 必要日の列で Ctrl+;（今日の日付）', async () => {
  await fresh(page); await sleep(150)
  await sel(page, 'R005'); const ok = await gotoCol(page, '必要日'); log(`  col 必要日 found=${ok} cursor=${await T.cursor(page)}`); await kd()
  await press('Control+;', 'R005')
  await page.keyboard.press('Enter'); await sleep(100); await press('Control+;', 'R005')
  if ((await ui(page)).mode === 'edit') { await page.keyboard.press('Escape'); await sleep(100) }
})
await step('D 設計: 編集中に Alt+Enter（セル内改行のつもり）→ 続けて打つ → Enter', async () => {
  await fresh(page); await sleep(150)
  await sel(page, 'R005'); await gotoCol(page, '部品名'); await kd()
  await typeReal(page, 'Relay', 20); await kd()
  await press('Alt+Enter', 'R005')
  await typeReal(page, 'Small', 20); await page.keyboard.press('Enter'); await sleep(200)
  log(`  after typing+Enter: keys=${await kd()} | ${await state()} | toast=${(await T.toast(page))?.slice(0, 160)} | ${await rowv('R005')}`)
})
await step('E 設計: 編集中に Ctrl+Enter（Excel では確定して動かない）', async () => {
  await fresh(page); await sleep(150)
  await sel(page, 'R010'); log(`  col found=${await gotoCol(page, '必要数')}`); await kd()
  await typeReal(page, '3', 20); await kd()
  await page.keyboard.press('Control+Enter'); await sleep(350)
  log(`  [Control+Enter] keys=${await kd()} | ${await state()} | toast=${(await T.toast(page))?.slice(0, 200)} | panel=${((await T.panelText(page)) ?? '-').slice(0, 200)} | ${await rowv('R010')}`)
  await shot(page, 'r35_E_ctrl_enter_in_edit')
  if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(150); log(`  Esc -> ${await state()} | toast=${await T.toast(page)}`) }
  const p = await proj(page); log(`  submissions=${p.submissions.length} last=Rev${p.submissions.at(-1)?.rev}`)
})
await step('F 購買: 単価の列で Ctrl+R・Ctrl+;・Ctrl+-', async () => {
  await fresh(page, 'purchasing'); await sleep(150)
  await sel(page, 'R005'); await gotoCol(page, '必要数'); await kd()
  for (const k of ['Control+r', 'Control+;', 'Control+-', 'PageDown', 'Control+End']) await press(k, 'R005')
})
save(errors); await browser.close()
