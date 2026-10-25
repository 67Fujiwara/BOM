// ラウンド22: 【削除？】が多い表 → 作成 → 公開(エラー) → Ctrl+K「順番に直すモード」→ 1 を押していく。途中で「飛ばす」「Esc」。案内の文のとおりに
import { launch, T, makeLog, ui, sleep, shot, proj, palette, runPalette } from './lib.mjs'
import { wizardPaste, probs, rowsText } from './w15.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 'r93_seq22')
const rows = ['リレー\tMY2N\tMY4N-D2\tオムロン\t2\t']
for (let i = 1; i <= 8; i++) rows.push(`部品${i}\tP-${i}0\tP-${i}0\tオムロン\t1\t`)
for (let i = 1; i <= 6; i++) rows.push(`未記入${i}\tE-${i}0\t\tオムロン\t1\t`)
rows.push('不明\tQ-1\t\tオムロン\t1\t削除に変更', '不明2\tQ-2\t\tオムロン\t1\t削除して良いか確認')
const text = ['品名\t型式（旧）\t型式（新）\tメーカー\t数量\t備考', ...rows].join('\n')
const pv = await wizardPaste(page, text); log('preview: ' + pv.slice(0, 700))
await page.keyboard.press('Enter'); await sleep(500)
let p = await proj(page); log('rows: ' + rowsText(p).slice(0, 400)); log('problems: ' + (await probs(page)).slice(0, 400))
log('toast: ' + await T.toast(page))
await page.keyboard.press('Control+Enter'); await sleep(400); log('Ctrl+Enter: ' + await T.toast(page))
if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(150) }
await page.locator('.gridwrap').focus()
log('== Ctrl+K 順番に直すモード')
const ok = await runPalette(page, '順番に直す', '順番に直すモード'); log('  palette ok: ' + ok); await sleep(300)
const U = async (tag) => { const u = await ui(page); log(`  [${tag}] mode=${u.mode} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} panel=${u.panel} | ${((await T.panelText(page)) ?? '').slice(0, 330)} | toast=${((await T.toast(page)) ?? '').slice(0, 160)}`) }
await U('start')
await shot(page, 'r93_seq_start')
for (let i = 0; i < 24; i++) {
  const txt = (await T.panelText(page)) ?? ''
  if (!txt) { log('  (no panel) -> stop'); break }
  const key = i === 3 ? '2' : '1'
  log(`  step ${i}: press ${key}`)
  await page.keyboard.press(key); await sleep(250)
  await U(`after ${i}`)
}
p = await proj(page); log('rows now: ' + p.rows.map((r) => `${r.id}:${r.status}:${(r.note ?? '').slice(0, 8)}`).join(' '))
log('problems: ' + await probs(page))
await page.keyboard.press('Escape'); await sleep(150)
await page.keyboard.press('Control+Enter'); await sleep(400); log('Ctrl+Enter again: ' + await T.toast(page) + ' | ' + ((await T.panelText(page)) ?? '').slice(0, 200))
save(errors); await browser.close()
