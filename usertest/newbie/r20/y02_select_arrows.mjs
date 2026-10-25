// 選択の列で打って ↓（Excel の癖）→ 何が入るか
import { launch, fresh, T, makeLog, shot, sel, gotoCol, ui, typeReal, proj, sleep, row } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('y02_select_arrows')
const st = async (tag) => { const u = await ui(page); log(`  [${tag}] mode=${u.mode} cur=${u.cursorRow}/${u.cursorCol} edit=${JSON.stringify(u.editValue)} | toast: ${await T.toast(page)}`) }
const eff = (r, k) => (r.working && k in r.working ? r.working[k] : r[k])
const cases = [
  ['単位', 'unit', 'pcs', 'R030', 'design'],
  ['単位', 'unit', 'set', 'R030', 'design'],
  ['単位', 'unit', 'hon', 'R030', 'design'],
  ['調達区分', 'procurement', 'sh', 'R030', 'design'],
  ['調達区分', 'procurement', 'zaiko', 'R030', 'design'],
  ['代替可否', 'altPolicy', 'fuka', 'R030', 'design'],
  ['代替可否', 'altPolicy', 'ka', 'R030', 'design'],
  ['メーカ指定', 'makerLock', 'shitei', 'R030', 'design'],
]
for (const [label, key, v, id, role] of cases) {
  for (const how of ['↓', '↓ Enter', 'Enter']) {
    await fresh(page, role); await sel(page, id); await gotoCol(page, label)
    const before = eff(await row(page, id), key)
    await typeReal(page, v, 25)
    const cands = await page.locator('.cands, [data-testid=candidates], .candidates').first().innerText().catch(() => '')
    if (how.startsWith('↓')) { await page.keyboard.press('ArrowDown'); await sleep(60) }
    const u1 = await ui(page)
    if (how.endsWith('Enter')) { await page.keyboard.press('Enter'); await sleep(80) }
    const u = await ui(page)
    const after = eff(await row(page, id), key)
    log(`${label}「${v}」${how}: ${before} -> ${after} | after↓ mode=${u1.mode} cur=${u1.cursorRow} | end mode=${u.mode} cur=${u.cursorRow} edit=${JSON.stringify(u.editValue)} | cands=${cands.replace(/\s+/g, ' ').slice(0, 80)} | toast=${await T.toast(page)}`)
    if (how === '↓ Enter') await shot(page, `y02_${key}_${v}`)
  }
}
save(errors); await browser.close()
