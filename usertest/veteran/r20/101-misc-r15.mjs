// ラウンド15: 表への貼り付け（Ctrl+V）で V15 の見出し・削除の行・〃 の形、表で打った「〃」「同上」、数字だけの氏名、Ctrl+D の既定動作
import { open, reset, sleep, logger, gotoCell, installToastLog, takeToasts, state } from './lib20.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`101-misc-r15-${port}${process.env.RUN ?? ''}.json`)
await env.context.grantPermissions(['clipboard-read', 'clipboard-write'])
const rowsNow = () => pg.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); return { n: p.rows.length, tail: p.rows.slice(80, 86).map((r) => [r.id, r.working?.name ?? r.name, r.working?.model ?? r.model, r.working?.maker ?? r.maker, r.working?.qtyNeeded ?? r.qtyNeeded].join('|')) } })
async function paste(name, tsv) {
  await reset(env); await gotoCell(pg, 1, 'R080', '部品名'); await pg.keyboard.press('ArrowDown')
  await pg.evaluate((x) => navigator.clipboard.writeText(x), tsv); await installToastLog(pg); await takeToasts(pg)
  await pg.keyboard.press('Control+v'); await pg.waitForFunction(() => !!(document.querySelector('[data-testid="toast-float"]') ?? document.querySelector('[data-testid="toast"]'))?.textContent, null, { timeout: 120000 }).catch(() => {}); await sleep(200)
  const panel = await pg.evaluate(() => document.querySelector('[data-testid^="panel-"]')?.dataset.testid ?? null)
  const panelText = panel ? await pg.evaluate(() => document.querySelector('[data-testid^="panel-"]')?.textContent?.slice(0, 500)) : null
  if (panel) { await pg.keyboard.press('Enter'); await sleep(500) }
  log({ name, panel, panelText, toasts: (await takeToasts(pg)).map((x) => x.slice(0, 300)), after: await rowsNow() })
}
const tsv = (rows) => rows.map((r) => r.join('\t')).join('\n')
await paste('P1 見積書の見出し「品名・仕様・数量・単価・金額」', tsv([['品名', '仕様', '数量', '単価', '金額'], ['リレー', 'DC24V', 12, 1200, 14400], ['端子台', '10P', 2, 300, 600]]))
await paste('P2 変えた行だけ変更後型式＋追加 1 行', tsv([['部品名', '型式', '変更後型式', '数量'], ['リレー', 'MY2N', 'MY4N', 12], ['端子台', 'XW2B', '', 2], ['ヒューズ', 'F-10', '', 4], ['電源', '', 'S8VK', 1]]))
await paste('P3 メーカが ASCII の「"」', tsv([['部品名', '型式', 'メーカ', '数量'], ['リレー', 'MY4N', 'オムロン', 12], ['リレー', 'MY2N', '"', 4], ['端子台', 'XW2B', 'オムロン', 2], ['ヒューズ', 'F-10', '富士', 4]]))
await paste('P4 新型式の列で「〃」', tsv([['部品名', '型式', '新型式', '数量'], ['リレーA', 'MY2N', 'MY4N', 12], ['リレーB', 'MY2N', '〃', 4]]))
// 表で打った「〃」「同上」
async function typed(name, row, col, text) {
  await reset(env); await gotoCell(pg, 1, row, col); await installToastLog(pg); await takeToasts(pg)
  await pg.keyboard.type(text); await pg.keyboard.press('Enter'); await sleep(300)
  await pg.keyboard.press('Alt+4'); await sleep(300)
  const inView4 = await pg.evaluate((id) => !!document.querySelector(`[data-testid="grid"] [data-row-id="${id}"]`), row)
  const prob = await pg.evaluate((id) => document.querySelector(`[data-testid="grid"] [data-row-id="${id}"]`)?.textContent?.slice(0, 160) ?? null, row)
  log({ name, toasts: (await takeToasts(pg)).map((x) => x.slice(0, 200)), inView4, prob })
}
await typed('T1 R010 メーカに「〃」と打つ', 'R010', 'メーカ', '〃')
await typed('T2 R010 部品名に「同上」と打つ', 'R010', '部品名', '同上')
await typed('T3 R010 型式に「"」と打つ', 'R010', '型式', '"')
// 数字だけの氏名
async function role(name, digit, who) {
  await reset(env); await installToastLog(pg); await takeToasts(pg)
  await pg.keyboard.press('Control+k'); await pg.getByTestId('palette-input').fill('役割を切り替え'); await sleep(100); await pg.keyboard.press('Enter'); await sleep(200)
  await pg.keyboard.press(digit); await pg.keyboard.press('Tab'); await pg.keyboard.type(who); await pg.keyboard.press('Enter'); await sleep(300)
  const u = await pg.evaluate(() => JSON.parse(localStorage.getItem('bom-pro.workspace.v2')).user)
  log({ name, toasts: (await takeToasts(pg)).map((x) => x.slice(0, 200)), user: u, panel: (await state(pg)).panel })
  await pg.keyboard.press('Escape')
}
await role('N1 購買・氏名「10234」（社員番号）', '2', '10234')
await role('N2 購買・氏名「１０２３４」（全角）', '2', '１０２３４')
await role('N3 購買・氏名「10234 山田」', '2', '10234 山田')
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log({ name: 'console/pageerror', errs: env.errs.slice(0, 20) })
log.save(); await env.browser.close()
