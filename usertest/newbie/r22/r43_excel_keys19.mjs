// ラウンド19: U18-01 の直し（Ctrl+X・Ctrl+;・Ctrl+R・Ctrl+-・Alt+Enter の知らせ）を新人の操作で。
// 表の上・編集中・購買の列・ダイアログの中で押す → 知らせの文のとおりに続ける（Ctrl+C → Delete → Ctrl+V、10/25 と打つ、Alt+Shift+D、Shift+Delete）
import { launch, fresh, T, makeLog, ui, sleep, shot, proj, sel, gotoCol, typeReal, clearToast, palette } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 'r43_excel_keys19')
const step = async (name, fn) => { try { log('== ' + name); await fn() } catch (e) { log('EXC', name, String(e).slice(0, 300)) } }
await page.addInitScript(() => { window.__kd = []; window.addEventListener('keydown', (e) => { window.__kd.push(`${e.ctrlKey ? 'C+' : ''}${e.shiftKey ? 'S+' : ''}${e.altKey ? 'A+' : ''}${e.key}:${e.defaultPrevented ? 'prevented' : 'browser'}`) }) })
const kd = async () => { const v = await page.evaluate(() => { const x = window.__kd.slice(); window.__kd.length = 0; return x }); return v.filter((x) => !/^(C\+Control|S\+Shift|A\+Alt|C\+S\+Shift|C\+A\+Alt)/.test(x)).join(',') }
const state = async () => { const u = await ui(page); return `mode=${u.mode} cur=${u.cursorRow}/${u.cursorCol} edit=${JSON.stringify(u.editValue)} panel=${u.panel} view=${u.view}` }
const rowv = async (id) => { const r = (await proj(page)).rows.find((x) => x.id === id); return r ? `${id}{name=${r.name} model=${r.model} maker=${r.maker} qty=${r.qtyNeeded} fixed=${r.needDateFixed ?? '-'} working=${JSON.stringify(r.working ?? null)} status=${r.status} cancelled=${!!r.cancelled}}` : `${id}:なし` }
async function press(k, id) {
  await clearToast(page)
  const n0 = (await proj(page)).rows.length
  await page.keyboard.press(k); await sleep(250)
  const n1 = (await proj(page)).rows.length
  log(`  [${k}] keys=${await kd()} | ${await state()} | toast=${(await T.toast(page))?.slice(0, 200)} | panel=${((await T.panelText(page)) ?? '-').slice(0, 160)} | rows ${n0}→${n1}${id ? ' | ' + (await rowv(id)) : ''}`)
}
await step('A 設計: 表の上（R005 型式）で Excel のキー（直したキーとまだのキー）', async () => {
  await fresh(page); await sleep(150)
  await sel(page, 'R005'); await gotoCol(page, '型式'); await kd()
  for (const k of ['Control+x', 'Control+;', 'Control+r', 'Control+-', 'Alt+Enter', 'Control+Shift+=', 'Control+=', 'Control+Shift+;', 'Shift+Space', 'Control+Space', 'F4', 'Control+h', 'Control+b', 'Control+1', 'Control+y']) {
    await press(k, 'R005')
    if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(100) }
  }
})
await step('B 設計: 知らせのとおり切り取りの代わり（下書きの行 R076 の型式を R077 の型式へ移す: Ctrl+X → 知らせ → Ctrl+C → Delete → R077 で Ctrl+V）', async () => {
  await fresh(page); await sleep(150)
  log('  before: ' + (await rowv('R076')) + ' | ' + (await rowv('R077')))
  await sel(page, 'R076'); await gotoCol(page, '型式'); await kd()
  await press('Control+x', 'R076')
  await press('Control+c', 'R076')
  await press('Delete', 'R076')
  await sel(page, 'R077'); await gotoCol(page, '型式'); await kd()
  await press('Control+v', 'R077')
  log('  after: ' + (await rowv('R076')) + ' | ' + (await rowv('R077')))
  log('  知らせの「Ctrl+Z で戻せます」: Ctrl+Z 2 回')
  await press('Control+z', 'R077'); await press('Control+z', 'R076')
})
await step('C 設計: 編集中（打ち始め・F2）に Ctrl+X・Alt+Enter・Ctrl+;・Ctrl+R・Ctrl+-', async () => {
  await fresh(page); await sleep(150)
  await sel(page, 'R076'); await gotoCol(page, '部品名'); await kd()
  await page.keyboard.press('F2'); await sleep(150)
  log('  F2: ' + (await state()))
  await page.keyboard.press('Shift+Home'); await sleep(80)
  await press('Control+x', 'R076')
  log('  editValue after Ctrl+X: ' + JSON.stringify((await ui(page)).editValue))
  await page.keyboard.press('End'); await press('Control+v', 'R076')
  await page.keyboard.press('Escape'); await sleep(100)
  await sel(page, 'R076'); await gotoCol(page, '備考'); await kd()
  await typeReal(page, 'kari', 20)
  await press('Alt+Enter', 'R076')
  await typeReal(page, 'oki', 20)
  await press('Control+;', 'R076')
  await press('Control+-', 'R076')
  await press('Enter', 'R076')
})
await step('D 設計: Ctrl+; の知らせのとおり日付を打つ（必要日の列で 10/25 → 知らせのとおり Ctrl+K「列の表示」で必要日(固定)を出す → 10/25 → Enter）', async () => {
  await fresh(page); await sleep(150)
  await sel(page, 'R076'); log(`  col 必要日 found=${await gotoCol(page, '必要日')}`); await kd()
  await press('Control+;', 'R076')
  await typeReal(page, '10/25', 30); await sleep(100)
  log(`  typed 10/25: ${await state()} | toast=${(await T.toast(page))?.slice(0, 220)}`)
  await palette(page, '列の表示'); await page.keyboard.press('Enter'); await sleep(200)
  log('  列の表示: マウスで「必要日(固定)」をクリック → Esc')
  await page.getByTestId('columns').locator('.opt', { hasText: '必要日(固定)' }).click(); await sleep(150)
  log('  item now: ' + (await page.getByTestId('columns').locator('.opt', { hasText: '必要日(固定)' }).innerText()).replace(/\s+/g, ' '))
  await page.keyboard.press('Escape'); await sleep(150)
  for (const id of ['R076', 'R005']) {
    await sel(page, id); log(`  ${id} col 必要日(固定) found=${await gotoCol(page, '必要日(固定)')}`); await kd()
    await typeReal(page, '10/25', 30); await sleep(100)
    await press('Enter', id)
    if ((await ui(page)).mode === 'edit') { await page.keyboard.press('Escape'); await sleep(100) }
  }
})
await step('E 設計: Ctrl+R の知らせのとおり Alt+Shift+D（行の複製）、Ctrl+- の知らせのとおり Shift+Delete（行の取消）', async () => {
  await fresh(page); await sleep(150)
  await sel(page, 'R076'); await gotoCol(page, '型式'); await kd()
  await press('Control+r', 'R076')
  await press('Alt+Shift+D', 'R076')
  const p = await proj(page); log('  last rows: ' + p.rows.slice(-3).map((r) => `${r.id}:${r.name}/${r.model}/${r.status}`).join(' '))
  await sel(page, 'R005'); await gotoCol(page, '型式'); await kd()
  await press('Control+-', 'R005')
  await press('Shift+Delete', 'R005')
  if (await T.panel(page)) { log('  panel: ' + (await T.panelText(page))); await page.keyboard.press('Escape'); await sleep(100) }
})
await step('F 購買・PM: 表の上で Ctrl+X・Ctrl+;・Ctrl+R・Ctrl+-（書けない列・書く列）', async () => {
  await fresh(page, 'purchasing'); await sleep(150)
  await sel(page, 'R005')
  for (const col of ['型式', '発注数']) {
    log(`  purchasing col ${col} found=${await gotoCol(page, col)}`); await kd()
    for (const k of ['Control+x', 'Control+;', 'Control+r', 'Control+-']) await press(k, 'R005')
  }
  await fresh(page, 'pm'); await sleep(150)
  await page.keyboard.press('ArrowDown'); await sleep(100); await kd()
  for (const k of ['Control+x', 'Control+-', 'Alt+Enter']) await press(k)
})
await step('G ダイアログ・絞り込みの欄の中で Ctrl+X（文字の切り取りはできるか）', async () => {
  await fresh(page); await sleep(150)
  await sel(page, 'R005'); await page.keyboard.press('/'); await sleep(150)
  await page.keyboard.type('relay'); await page.keyboard.press('Shift+Home'); await kd()
  await press('Control+x')
  log('  filter value: ' + JSON.stringify(await page.locator('input.filter').inputValue().catch(() => '?')))
  await page.keyboard.press('Escape'); await sleep(100)
  await palette(page, 'リレー'); await page.keyboard.press('Shift+Home'); await kd()
  await press('Control+x')
  log('  palette value: ' + JSON.stringify(await page.getByTestId('palette-input').inputValue().catch(() => '?')))
  await page.keyboard.press('Escape')
})
await shot(page, 'r43_end')
save(errors); await browser.close()
