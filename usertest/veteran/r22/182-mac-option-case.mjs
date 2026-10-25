// ラウンド20: macOS の Option（key が ¥ ¢ ≈ å などの文字になる）で PM の案件の行（7）を操作する。Option+y で確定、Option+4 でビュー 4 になるか
import { open, reset, sleep, logger, state, installToastLog, takeToasts } from './lib22.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const A = env.page; const log = logger(`182-mac-option-case-${port}${process.env.RUN ?? ''}.json`)
await env.context.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'platform', { get: () => 'MacIntel' }) })
const LSK = 'bom-pro.workspace.v2'
async function setup() {
  await reset(env)
  await A.evaluate((k) => { const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); p.settings.pmConfirmed = false; p.decisions = p.decisions.filter((d) => d.kind !== '案件設定確定'); p.caseDecisions = [{ id: 'C1', kind: '案件設定確定', status: 'open', at: new Date().toISOString() }]; localStorage.setItem(k, JSON.stringify(w)) }, LSK)
  await A.reload(); await A.waitForSelector('[data-testid="grid"]')
  await A.getByTestId('role-pm').click(); for (let i = 0; i < 3; i++) { if (!(await A.evaluate(() => !!document.querySelector('[data-testid^="panel-"]')))) break; await A.keyboard.press('Enter') }
  await A.locator('.gridwrap').focus(); await A.keyboard.press('7'); await sleep(150)
  await A.keyboard.press('ArrowDown'); await A.keyboard.press('ArrowUp'); await sleep(100)
  await installToastLog(A)
}
const OPT = [['¥', 'KeyY'], ['¢', 'Digit4'], ['≈', 'KeyX'], ['å', 'KeyA'], ['Y', 'KeyY', true], ['¡', 'Digit1']]
for (const [key, code, shift] of OPT) {
  await setup()
  const before = await state(A)
  await A.evaluate(([key, code, shift]) => { const t = document.activeElement ?? document.body; t.dispatchEvent(new KeyboardEvent('keydown', { key, code, altKey: true, shiftKey: !!shift, bubbles: true, cancelable: true })) }, [key, code, shift])
  await sleep(250)
  const st = await state(A)
  const info = await A.evaluate((k) => { const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); return { confirmed: p.settings.pmConfirmed } }, LSK)
  log({ key, code, shift: !!shift, before: { view: before.view }, after: { view: st.view, cursor: st.cursor, mode: st.mode }, info, toast: (await takeToasts(A)).filter((t) => !t.startsWith('保存') && !t.startsWith('役割')).slice(-2).join(' ／ ').slice(0, 120) })
}
log({ name: 'console/pageerror', errs: env.errs.slice(0, 20) })
log.save(); await env.browser.close()
