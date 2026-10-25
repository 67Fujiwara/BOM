// ラウンド15（新人では初めて）: 見本の BOM を「表示中の行と列を書式つきでコピー」（Ctrl+Shift+C）→ 似た盤の新しい BOM のガイドにそのまま貼る。列の見出し（必要数・メーカ・ボール…）を読めるか、分類の見出しの行・状態の列はどうなるか
import { launch, fresh, T, makeLog, sleep, shot, proj, palette, sel } from './lib.mjs'
import { rowsText, probs } from './w15.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 'r08_copy_roundtrip')
await fresh(page)
for (const v of ['1', '4']) {
  await page.keyboard.press(v); await sleep(200)
  await page.keyboard.press('Control+Shift+C'); await sleep(400)
  const t = await page.evaluate(() => navigator.clipboard.readText())
  const lines = t.split('\n')
  log(`[view ${v}] toast: ${await T.toast(page)} | ${lines.length} lines`)
  log('  head: ' + JSON.stringify(lines[0]))
  log('  line1: ' + JSON.stringify(lines[1]))
  log('  line2: ' + JSON.stringify(lines[2]))
  if (v === '1') {
    // ガイドに貼る（新人: 同じような盤なのでコピーして作る）
    await palette(page, '新しいBOM'); await page.keyboard.press('Enter'); await page.getByTestId('wizard').waitFor()
    for (let i = 0; i < 7; i++) await page.keyboard.press('Enter')
    await page.keyboard.press('1'); await sleep(80)
    await page.getByTestId('wizard-paste').fill(t); await sleep(80)
    await page.keyboard.press('Control+Enter'); await sleep(300)
    const pv = (await page.getByTestId('wizard-preview').innerText().catch(() => '-')).replace(/\s+/g, ' ')
    log('  preview: ' + pv.replace(/^.*?取り込む行/, '取り込む行').slice(0, 900))
    await shot(page, 'r08_preview')
    await page.keyboard.press('Enter'); await sleep(400)
    const p = await proj(page)
    log(`  created ${p.id} rows=${p.rows.length}: ${rowsText(p).slice(0, 900)}`)
    log('  toast: ' + (await T.toast(page)))
    log('  problems: ' + (await probs(page)).slice(0, 600))
    const ws = await page.evaluate(async () => { const m = await import('/src/model/store.ts'); const s = m.useStore.getState().ws; return s.projects.map((x) => `${x.id}:${x.rows.length}`) })
    log('  projects: ' + ws.join(' '))
    // 見本に戻る
    await palette(page, '受信箱'); await page.keyboard.press('Enter'); await sleep(150); await page.keyboard.press('Enter'); await sleep(300)
  }
}
save(errors); await browser.close()
