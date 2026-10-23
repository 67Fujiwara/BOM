// ラウンド7: JSON の settings.formalDays が大きい（1e5 / 1e6 / 1e7。画面からは 0〜365 しか入らない）案件で、購買が「正式見積を依頼（社外）」
// → 何秒止まるか（営業日を 1 日ずつ数える addBusinessDays が残っている）
import { open, reset, gotoCell, snap, sleep, saveJson } from './lib7.mjs'
import { palette } from '../r6/rerun5/lib.mjs'
const env = await open(Number(process.env.PORT ?? 5197)); const pg = env.page; const out = []
for (const days of [7, 1e5, 1e6, 1e7]) {
  await reset(env)
  // 設計が R040 を採用して選定済にする
  await gotoCell(pg, 1, 'R040', 'ID'); await pg.keyboard.press('a'); await sleep(100)
  await pg.keyboard.press('Control+s'); await sleep(50)
  await pg.evaluate((d) => { const k = 'bom-pro.workspace.v2'; const w = JSON.parse(localStorage.getItem(k)); for (const p of w.projects) p.settings.formalDays = d; localStorage.setItem(k, JSON.stringify(w)) }, days)
  await pg.evaluate(() => { Storage.prototype.setItem = function () {} }); await pg.reload(); await pg.waitForSelector('[data-testid="grid"]'); await pg.locator('.gridwrap').focus()
  await pg.getByTestId('role-purchasing').click(); for (let i = 0; i < 3; i++) { if (!(await pg.evaluate(() => !!document.querySelector('[data-testid^="panel-"]')))) break; await pg.keyboard.press('Enter'); await sleep(30) }
  await pg.locator('.gridwrap').focus()
  await palette(pg, '正式見積を依頼'); await sleep(100)
  const conf = await pg.evaluate(() => document.querySelector('[data-testid^="panel-"]')?.innerText?.slice(0, 80) ?? '')
  const t0 = Date.now()
  await pg.keyboard.press('2'); await sleep(20); await pg.keyboard.press('Enter')
  // ページが応答するまで（評価が返るまで）の時間
  await pg.waitForFunction(() => /正式見積を依頼|依頼する行/.test((document.querySelector('[data-testid="toast-float"]') ?? document.querySelector('[data-testid="toast"]'))?.textContent ?? ''), null, { timeout: 120000, polling: 200 }).catch(() => {})
  const ms = Date.now() - t0
  const s = await snap(pg)
  const due = await pg.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); return p.rows.find((r) => r.id === 'R040')?.dueAt })
  const rec = { formalDays: days, confirm: conf.replace(/\n/g, ' '), ms, toast: s.toast.slice(0, 80), R040dueAt: due }
  out.push(rec); console.log(JSON.stringify(rec))
  if (ms > 100000) break
}
saveJson('80-formaldays.json', out); await env.browser.close()
