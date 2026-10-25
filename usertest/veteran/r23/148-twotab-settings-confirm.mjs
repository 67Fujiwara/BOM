// ラウンド19: ラウンド18 の修正（U18-04: 案件設定を確定済みなら断る・確定したら知らせる）の境目。PM の 2 タブで「7 要決定」の先頭の
// 「案件設定確定」の行で y を続けて押す（間 0・30・400ms）／パレット「案件設定を確定（PM）」を 2 回／確定したあと別のタブで納期を変えてもう一度確定
import { open, reset, sleep, logger, state, installToastLog, takeToasts } from './lib22.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const A = env.page; const log = logger(`148-twotab-settings-confirm-${port}${process.env.RUN ?? ''}.json`)
const LSK = 'bom-pro.workspace.v2'
const info = (pg) => pg.evaluate((k) => { const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); return { confirmed: p.settings.pmConfirmed, decisions: p.decisions.filter((d) => d.kind === '案件設定確定').length, caseDecisions: p.caseDecisions.map((c) => `${c.kind}:${c.status}`).join(','), events: p.events.slice(-3).map((e) => e.text).join(' / ') } }, LSK)
async function asPM(pg) {
  await pg.getByTestId('role-pm').click(); for (let i = 0; i < 3; i++) { if (!(await pg.evaluate(() => !!document.querySelector('[data-testid^="panel-"]')))) break; await pg.keyboard.press('Enter') }
  await pg.locator('.gridwrap').focus(); await pg.keyboard.press('7'); await sleep(150)
  // 先頭（案件の要決定の行）へ
  await pg.keyboard.press('ArrowDown'); await pg.keyboard.press(process.env.UPKEY ?? 'ArrowUp'); await sleep(100)
  return (await state(pg)).cursor + ' ' + (await pg.evaluate(() => document.querySelector('[data-testid="case-row"].sel')?.textContent?.slice(0, 30) ?? '（案件の行ではない）'))
}
async function S(name, expect, fn) {
  await reset(env)
  // 案件設定を未確定に、7 の先頭に「案件設定確定」の要決定を置く（Rev.1 の公開で付くのと同じ形）
  await A.evaluate((k) => { const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); p.settings.pmConfirmed = false; p.decisions = p.decisions.filter((d) => d.kind !== '案件設定確定'); p.caseDecisions = [{ id: 'C1', kind: '案件設定確定', status: 'open', at: new Date().toISOString() }]; localStorage.setItem(k, JSON.stringify(w)) }, LSK)
  await A.reload(); await A.waitForSelector('[data-testid="grid"]')
  const ca = await asPM(A); await installToastLog(A)
  const B = await env.context.newPage(); await B.goto(env.url); await B.waitForSelector('[data-testid="grid"]'); const cb = await asPM(B); await installToastLog(B)
  const curA = async () => `${(await state(A)).cursor} ${await A.evaluate(() => document.querySelector('[data-testid="case-row"].sel') ? '（案件の行を選択中）' : '（案件の行は選択されていない）')}`
  const seq = [`A カーソル ${ca}・B カーソル ${cb}`, `B を開いたあとの A のカーソル: ${await curA()}`, `前: ${JSON.stringify(await info(A))}`]
  await fn(B, seq)
  await sleep(800)
  seq.push(`後: ${JSON.stringify(await info(A))}`)
  seq.push(`A の知らせ: ${(await takeToasts(A)).filter((t) => !t.startsWith('保存') && !t.startsWith('役割')).slice(-2).join(' ／ ')}`)
  seq.push(`B の知らせ: ${(await takeToasts(B)).filter((t) => !t.startsWith('保存') && !t.startsWith('役割')).slice(-2).join(' ／ ')}`)
  log({ name, expect, seq }); await B.close()
}
await S('T1 B は開くだけ。A で y（1 回）', '確定する（決定 1 件）', async () => { await A.bringToFront(); await A.keyboard.press('y'); await sleep(300) })
await S('T1b B は開くだけ。A で ↓↑ で案件の行を選び直して y', '確定する（決定 1 件）', async () => { await A.bringToFront(); await A.locator('.gridwrap').focus(); await A.keyboard.press('ArrowDown'); await A.keyboard.press('ArrowUp'); await sleep(100); await A.keyboard.press('y'); await sleep(300) })
for (const gap of [0, 30, 400]) {
  await S(`T${gap} 2 タブでパレット「案件設定を確定（PM）」を開いておき、A の Enter の ${gap}ms 後に B の Enter`, '確定は 1 回（決定 1 件）。あとのタブは「もう確定しています」', async (B) => {
    for (const pg of [A, B]) { await pg.bringToFront(); await pg.locator('.gridwrap').focus(); await pg.keyboard.press('Control+k'); await pg.getByTestId('palette-input').fill('案件設定を確定'); await sleep(120) }
    await Promise.all([A.keyboard.press('Enter'), (async () => { await sleep(gap); await B.keyboard.press('Enter') })()])
    await sleep(300)
    for (const pg of [A, B]) for (let k = 0; k < 2; k++) if (await pg.evaluate(() => !!document.querySelector('[data-testid="panel-prompt"]'))) { await pg.keyboard.press('Enter'); await sleep(200) }
  })
}
await S('T2 同じタブでパレット「案件設定を確定（PM）」を 2 回', '2 回目は「もう確定しています」', async (B) => {
  for (let i = 0; i < 2; i++) { await A.bringToFront(); await A.keyboard.press('Control+k'); await A.getByTestId('palette-input').fill('案件設定を確定'); await sleep(80); await A.keyboard.press('Enter'); await sleep(300); for (let k = 0; k < 2; k++) if (await A.evaluate(() => !!document.querySelector('[data-testid="panel-prompt"]'))) { await A.keyboard.press('Enter'); await sleep(200) } }
})
log({ name: 'console/pageerror', errs: env.errs.slice(0, 20) })
log.save(); await env.browser.close()
