// ラウンド19: 必要日の表示に年が無い（src/model/dates.ts の fmtDate は MM/DD）。画面の欄で入れられる範囲（前倒し ±365・固定日）の値を
// 保存データに入れて（「列の表示」で出した必要日(前倒し)・必要日(固定)の列に打ったのと同じ）、表の必要日の列・詳細の「必要日」が今年と見分けられるか
import { open, reset, sleep, logger } from './lib22.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`145-needdate-year-${port}${process.env.RUN ?? ''}.json`)
const LSK = 'bom-pro.workspace.v2'
const rowText = (id) => pg.evaluate((id) => document.querySelector(`[data-row-id="${id}"]`)?.innerText.replace(/\s+/g, ' ').slice(0, 220) ?? '', id)
for (const [k, v] of [['needOffset', null], ['needOffset', 365], ['needOffset', -365], ['needDateFixed', '2027-11-13'], ['needDateFixed', '2025-11-13']]) {
  await reset(env)
  await pg.evaluate(([LSK, k, v]) => { const w = JSON.parse(localStorage.getItem(LSK)); const p = w.projects.find((x) => x.id === w.currentProjectId); const r = p.rows.find((x) => x.id === 'R005'); r[k] = v; localStorage.setItem(LSK, JSON.stringify(w)) }, [LSK, k, v])
  await pg.reload(); await pg.waitForSelector('[data-testid="grid"]'); await pg.locator('.gridwrap').focus(); await sleep(300)
  await pg.keyboard.press('Alt+1'); await pg.keyboard.press('Control+g'); await pg.getByTestId('prompt-text').fill('R005'); await pg.keyboard.press('Enter'); await sleep(200)
  const row = await rowText('R005')
  await pg.keyboard.press('Home'); await pg.keyboard.press('Space'); await sleep(250)
  const detail = await pg.evaluate(() => (document.querySelector('[data-testid="detail"]') ?? document.querySelector('.detail'))?.innerText.replace(/\s+/g, ' ').slice(0, 200) ?? '')
  await pg.keyboard.press('Escape')
  log({ name: `R005 ${k} = ${v}（案件の納期 2026-11-23）`, row, detail: (/必要日 [^/]*\/[^ ]*/.exec(detail) ?? [''])[0] + ' … ' + (/1\. .{0,40}/.exec(detail) ?? [''])[0] + ' ／ 状態: ' + row.slice(-40) })
}
log({ name: 'console/pageerror', errs: env.errs.slice(0, 20) })
log.save(); await env.browser.close()
