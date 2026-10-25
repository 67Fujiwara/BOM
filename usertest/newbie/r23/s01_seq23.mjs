// ラウンド23 s01: 順番に直すモードで 2（あとで）3（飛ばす）1（要る部品）を混ぜて押す。表示 1／4／9、問題行 14（【削除？】12＋型式空欄2）。どの行を何回見たか・終わりの知らせ・残り
import { launch, T, makeLog, ui, sleep, shot, proj, runPalette } from './lib.mjs'
import { wizardPaste } from './w15.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 's01_seq23')
const mk = (nAmb = 6, nNote = 6) => {
  const rows = ['リレー\tMY2N\tMY4N-D2\tオムロン\t2\t']
  for (let i = 1; i <= 3; i++) rows.push(`部品${i}\tP-${i}0\tP-${i}0\tオムロン\t1\t`)
  for (let i = 1; i <= nAmb; i++) rows.push(`未記入${i}\tE-${i}0\t\tオムロン\t1\t`)
  for (let i = 1; i <= nNote; i++) rows.push(`予定${i}\tQ-${i}0\t\tオムロン\t1\t${['削除予定', '一部削除', '削除？', '削除検討', '廃止予定', '撤去予定'][i % 6]}`)
  return ['品名\t型式（旧）\t型式（新）\tメーカー\t数量\t備考', ...rows].join('\n')
}
const flagged = async () => { const p = await proj(page); return p.rows.filter((r) => String(r.note ?? '').startsWith('【削除？】')).map((r) => r.name) }
const scenarios = [
  ['all2', (i) => '2'], ['all3', (i) => '3'], ['all1', (i) => '1'],
  ['mix2-3-1', (i) => ['2', '3', '1'][i % 3]], ['mix1-2', (i) => (i % 2 ? '2' : '1')], ['mix3-1', (i) => (i % 2 ? '1' : '3')],
]
for (const view of [4, 1, 9]) for (const [sn, keyOf] of scenarios) {
  await wizardPaste(page, mk())
  await page.keyboard.press('Enter'); await sleep(450)
  await page.keyboard.press('Control+Enter'); await sleep(350)
  if (await T.panel(page)) await page.keyboard.press('Escape')
  await page.locator('.gridwrap').focus()
  if (view !== 1) { await page.keyboard.press(`Alt+${view}`); await sleep(200) }
  const v = await ui(page)
  const f0 = await flagged()
  await page.keyboard.press('F8'); await sleep(150)
  const ok = await runPalette(page, '順番に直す', '順番に直すモード'); await sleep(350)
  const trace = []
  const visits = {}
  let ended = null
  for (let i = 0; i < 40; i++) {
    if (!(await T.panel(page))) { ended = 'panel閉じた'; break }
    const u = await ui(page)
    const pt = ((await T.panelText(page)) ?? '').slice(0, 40)
    const key = keyOf(i)
    visits[u.cursorRow] = (visits[u.cursorRow] ?? 0) + 1
    trace.push(`${u.cursorRow}:${key}`)
    await page.keyboard.press(key); await sleep(200)
    if (!(await ui(page)).mode) break
  }
  const toast = ((await T.toast(page)) ?? '').slice(0, 120)
  const f1 = await flagged()
  const u2 = await ui(page)
  const multi = Object.entries(visits).filter(([, n]) => n > 1).map(([k, n]) => `${k}x${n}`)
  log(`view ${v.view}(要求${view}) ${sn}: palette=${ok} flagged ${f0.length}→${f1.length} steps=${trace.length} 行の種類=${Object.keys(visits).length} 2回以上見た=${multi.join(',') || '-'} end=${ended ?? 'steps上限'} role=${v.role} panel=${u2.panel} | toast=${toast}`)
  log('   trace: ' + trace.join(' '))
}
save(errors); await browser.close()
