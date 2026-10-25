// ラウンド20: PM の 7 の「案件設定確定」の行（V19-13 の修正: y / Shift+Y だけ 1 キー操作）で、ほかのキー（数字・英字・記号・Enter・Space・矢印・Alt+数字）が前と同じに動くか。
import { open, reset, sleep, logger, state, installToastLog, takeToasts } from './lib20.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const A = env.page; const log = logger(`164-case-row-keys-${port}${process.env.RUN ?? ''}.json`)
const info = (pg) => pg.evaluate((k) => { const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); return { confirmed: p.settings.pmConfirmed, decisions: p.decisions.filter((d) => d.kind === '案件設定確定').length } }, 'bom-pro.workspace.v2')
async function setup() {
  await reset(env)
  await A.evaluate((k) => { const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); p.settings.pmConfirmed = false; p.decisions = p.decisions.filter((d) => d.kind !== '案件設定確定'); p.caseDecisions = [{ id: 'C1', kind: '案件設定確定', status: 'open', at: new Date().toISOString() }]; localStorage.setItem(k, JSON.stringify(w)) }, 'bom-pro.workspace.v2')
  await A.reload(); await A.waitForSelector('[data-testid="grid"]')
  await A.getByTestId('role-pm').click(); for (let i = 0; i < 3; i++) { if (!(await A.evaluate(() => !!document.querySelector('[data-testid^="panel-"]')))) break; await A.keyboard.press('Enter') }
  await A.locator('.gridwrap').focus(); await A.keyboard.press('7'); await sleep(150)
  await A.keyboard.press('ArrowDown'); await A.keyboard.press('ArrowUp'); await sleep(100)
  await installToastLog(A)
}
const KEYS = ['4', '1', 'Alt+4', 'Shift+4', '1', 'x', 'a', 'b', 'Shift+Y', 'y', '?', '/', '[', ']', '<', '>', 'Enter', 'Space', 'F2', 'ArrowDown', 'Tab', 'Delete', 'Control+z', 'Shift+Enter', 'Control+Enter', 'F8', 'w', 'j', 'Numpad4', 'NumpadEnter', 'Alt+x', 'Alt+y', 'Escape']
for (const k of KEYS) {
  await setup()
  const before = await state(A)
  const sel = await A.evaluate(() => document.querySelector('[data-testid="case-row"].sel') ? 'case-sel' : 'no-case-sel')
  await A.keyboard.press(k).catch(() => {}); await sleep(250)
  // 続けて Enter のあと案内のダイアログが出たら Escape
  const st = await state(A)
  const panel = await A.evaluate(() => document.querySelector('[data-testid^="panel-"]')?.dataset.testid ?? null)
  log({ k, before: { view: before.view, cursor: before.cursor, mode: before.mode, sel }, after: { view: st.view, cursor: st.cursor, mode: st.mode, panel, caseSel: await A.evaluate(() => !!document.querySelector('[data-testid="case-row"].sel')) }, info: await info(A), toast: (await takeToasts(A)).filter((t) => !t.startsWith('保存') && !t.startsWith('役割')).slice(-2).join(' ／ ').slice(0, 160) })
  await A.keyboard.press('Escape'); await A.keyboard.press('Escape')
}
log({ name: 'console/pageerror', errs: env.errs.slice(0, 20) })
log.save(); await env.browser.close()
