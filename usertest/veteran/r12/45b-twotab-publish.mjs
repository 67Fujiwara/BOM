// ラウンド12: 公開の変更セットのダイアログ（対象の行が出る）を開いたあと、別のタブで別の行を変えると、ダイアログに出ていない行も公開されるか
import { open, reset, gotoCell, sleep, logger, installToastLog, takeToasts } from './lib12.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const A = env.page; const log = logger(`45b-twotab-publish-${port}.json`)
for (const variant of ['B が R011 部品名を変える', 'B が R012 を取消（Shift+Delete）']) {
  await reset(env); await gotoCell(A, 1, 'R010', '部品名'); await A.keyboard.type('PUB-A'); await A.keyboard.press('Enter')
  await installToastLog(A); await takeToasts(A)
  await A.keyboard.press('Control+Enter'); await sleep(200)
  const title = await A.evaluate(() => document.querySelector('[data-testid="panel-prompt"]')?.textContent?.slice(0, 160))
  const B = await env.context.newPage(); await B.goto(env.url); await B.waitForSelector('[data-testid="grid"]'); await B.locator('.gridwrap').focus()
  if (variant.includes('R011')) { await gotoCell(B, 1, 'R011', '部品名'); await B.keyboard.type('PUB-B'); await B.keyboard.press('Enter') }
  else { await gotoCell(B, 1, 'R012', 'ID'); await B.keyboard.press('Shift+Delete'); await sleep(150); await B.keyboard.press('Enter') }
  await sleep(500); await A.bringToFront(); await sleep(200)
  const title2 = await A.evaluate(() => document.querySelector('[data-testid="panel-prompt"]')?.textContent?.slice(0, 160))
  await A.keyboard.press('2'); await A.keyboard.press('Enter'); await sleep(400)
  const sub = await A.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); const s = p.submissions.at(-1); return { rev: s.rev, changeSet: s.changeSet, rows: p.rows.filter((r) => r.publishedRev === s.rev && ['R010', 'R011', 'R012'].includes(r.id)).map((r) => r.id + ':' + (r.removal?.kind ?? r.name)), ev: p.events.slice(-2).map((e) => e.text) } })
  log({ variant, title, titleAfterB: title2, sub, toasts: await takeToasts(A) })
  await B.close()
}
log.save(); await env.browser.close()
