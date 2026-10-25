// ラウンド14: 「未定」の警告（N13-06 の修正）を新人が知らせのとおりに片付ける: Ctrl+Enter → F8 → Alt+x → Ctrl+Enter。型式とメーカーの両方が未定の行、確認済みのあとで別の欄を未定に
import { launch, fresh, T, makeLog, sel, gotoCol, ui, typeReal, proj, sleep, shot, row, setRole, palette } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('q08_tbd_ack')
const probs = () => page.evaluate(async () => {
  const find = (k) => performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes(k)) ?? k
  const s = (await import(find('/src/model/store.ts'))).useStore.getState()
  const R = await import(find('/src/model/rules.ts'))
  const p = s.ws.projects.find((x) => x.id === s.ws.currentProjectId)
  return p.rows.map((r) => `${r.id}[${r.model}/${r.maker}]ack=${JSON.stringify(r.ackRules)}:` + R.checkRow(r, s.ws.rules, p).map((x) => `${x.severity[0]}/${x.field}`).join(';')).join(' | ')
})
const st = async (tag) => { const u = await ui(page); log(`  [${tag}] mode=${u.mode} cur=${u.cursorRow}/${u.cursorCol} panel=${u.panel} | ${(await T.panelText(page))?.slice(0, 120) ?? ''} | toast: ${await T.toast(page)}`) }
await fresh(page); await palette(page, '新しいBOM'); await page.keyboard.press('Enter'); await page.getByTestId('wizard').waitFor()
for (let i = 0; i < 7; i++) await page.keyboard.press('Enter')
await page.keyboard.press('1'); await sleep(80)
await page.getByTestId('wizard-paste').fill('品名\t型式\tメーカー\t数量\nリレー\tMY4N-D2\tオムロン\t4\nヒューズ\t未定\t未定\t2\n端子台\tXW2B-20G4\t-\t3')
await page.keyboard.press('Control+Enter'); await sleep(200); await page.keyboard.press('Enter'); await sleep(300); await st('created')
log('  ' + (await probs()))
await page.keyboard.press('Control+Enter'); await sleep(200); await st('Ctrl+Enter')
// 知らせのとおり: F8 → Alt+x を繰り返す
for (let i = 0; i < 4; i++) {
  await page.keyboard.press('F8'); await sleep(150); await st('F8')
  if ((await ui(page)).panel) { await page.keyboard.press('Escape'); await sleep(80) }
  await page.keyboard.press('Alt+x'); await sleep(150); await st('Alt+x')
  log('  ' + (await probs()))
}
await page.keyboard.press('Control+Enter'); await sleep(250); await st('Ctrl+Enter 2')
const p = await proj(page); log('  published: ' + p.rows.map((r) => `${r.id}:${r.status}:${r.publishedRev}`).join(' '))
// 確認済みのあと、メーカーが決まったので入れる → 型式はまだ未定のまま → さらに別の行で型式を TBD に
await sel(page, 'R002'); await gotoCol(page, 'メーカ'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.insertText('富士端子'); await page.keyboard.press('Enter'); await sleep(150)
await sel(page, 'R001'); await gotoCol(page, '型式'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.insertText('TBD'); await page.keyboard.press('Enter'); await sleep(150)
await sel(page, 'R003'); await gotoCol(page, '型式'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.insertText('未定'); await page.keyboard.press('Enter'); await sleep(150)
log('  after edits: ' + (await probs()))
await page.keyboard.press('Control+Enter'); await sleep(200); await st('Ctrl+Enter 3')
if ((await ui(page)).panel) { await page.keyboard.press('1'); await page.keyboard.press('Enter'); await sleep(250); await st('1 Enter') }
await setRole(page, 'purchasing'); await sleep(150)
log('  purch: ' + (await page.getByTestId('row').evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').slice(0, 70)).join(' || '))))
save(errors); await browser.close()
