// ラウンド8: 書ける列が 1 つも無いビュー（購買の 2・4・5・7、PM の全ビュー）で、新人が部品名などに単語を打つ
import { launch, fresh, T, makeLog, shot, sel, gotoCol, ui, typeReal, proj, sleep, diff } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t61_noedit_views')
const state = async (tag) => { const u = await ui(page); log(`  [${tag}] role=${u.role} mode=${u.mode} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} edit=${JSON.stringify(u.editValue)} panel=${u.panel} sort=${JSON.stringify(u.sort)} filter=${JSON.stringify(u.cellFilter)} | hints: ${await T.hints(page)} | toast: ${await T.toast(page)}`) }
const strip = (r) => { const { updatedAt, statusChangedAt, dueAt, ...x } = r; return x }
const changes = async (p0) => { const p1 = await proj(page); const out = []; for (const r of p1.rows) { const r0 = p0.rows.find((x) => x.id === r.id); const d = diff(strip(r0 ?? {}), strip(r)); if (d) out.push(`${r.id}: ${d}`) } ; if (p1.issues.length !== p0.issues.length) out.push(`issues ${p0.issues.length}->${p1.issues.length}`); const di = p1.issues.filter((i, k) => JSON.stringify(i) !== JSON.stringify(p0.issues[k])).map((i) => `${i.id}:${i.status}`); if (di.length) out.push('issue changes ' + di.join(',')); if ((p1.decisions?.length ?? 0) !== (p0.decisions?.length ?? 0)) out.push(`decisions ${p0.decisions?.length}->${p1.decisions?.length}`); return out.join(' ; ') || '(なし)' }
const step = async (name, fn) => { try { log('== ' + name); await fn() } catch (e) { log('EXC', name, String(e).slice(0, 300)) } }

const cases = [
  // role, view, row(null=1行目), col, word
  ['purchasing', 4, null, '部品名', 'ok'],
  ['purchasing', 4, null, '部品名', 'in stock'],
  ['purchasing', 4, null, '型式', 'hai'],
  ['purchasing', 4, null, '備考', 'sumi'],
  ['purchasing', 2, 'R013', '部品名', 'in stock'],
  ['purchasing', 2, 'R013', '備考', 'nouki ok'],
  ['purchasing', 2, 'R030', 'メーカ', 'Omron'],
  ['purchasing', 5, null, '部品名', 'checked'],
  ['purchasing', 7, null, '部品名', 'yes'],
  ['pm', 7, null, '部品名', 'ok'],
  ['pm', 7, null, '部品名', 'hai'],
  ['pm', 1, 'R013', '部品名', 'in stock'],
  ['pm', 1, 'R030', '備考', 'yes'],
]
for (const [role, view, id, col, word] of cases) {
  await step(`${role} view ${view} ${id ?? '(先頭)'} ${col} に「${word}」→ Enter`, async () => {
    await fresh(page, role); await sleep(150)
    await page.keyboard.press(String(view)); await sleep(150)
    if (id) await sel(page, id); else { await page.keyboard.press('ArrowDown'); await page.keyboard.press('Control+ArrowUp') }
    await sleep(80)
    const ok = await gotoCol(page, col)
    const p0 = await proj(page)
    await state(`at ${col} (${ok})`)
    log('  side:', (await page.getByTestId('side').innerText()).replace(/\s+/g, ' ').slice(0, 60))
    await typeReal(page, word, 50); await sleep(150); await state(`typed ${word}`)
    await page.keyboard.press('Enter'); await sleep(150); await state('Enter')
    log('  CHANGES:', await changes(p0))
    await shot(page, `t61_${role}_${view}_${word.replace(/\W/g, '_')}`)
  })
}
save(errors); await browser.close()
