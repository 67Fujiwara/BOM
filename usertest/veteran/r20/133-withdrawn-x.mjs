// ラウンド18: U17-01 の修正（x 1 回で取下げ 1 社）を速打ち・Ctrl+Z/Y・リロード・2 タブ・取消した行（ビュー 9）で
import { open, reset, sleep, logger, state } from './lib20.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const A = env.page; const log = logger(`133-withdrawn-x-${port}${process.env.RUN ?? ''}.json`)
const LSK = 'bom-pro.workspace.v2'
const toastOf = (pg) => pg.evaluate(() => (document.querySelector('[data-testid="toast-float"]') ?? document.querySelector('[data-testid="toast"]'))?.textContent?.slice(0, 400) ?? '')
const fw = (pg, id = 'R013') => pg.evaluate(([k, id]) => { const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); return p.rows.find((r) => r.id === id)?.flags.formalWithdrawn ?? null }, [LSK, id])
const W3 = '因幡電機 FR-1 / 商社B FR-2 / 商社C FR-3'
async function setup(pg, mut) {
  await pg.evaluate(([k, w3, m]) => { const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); const r = p.rows.find((x) => x.id === 'R013'); r.flags.formalWithdrawn = w3; if (m === 'cancel') r.status = 'cancelled'; localStorage.setItem(k, JSON.stringify(w)) }, [LSK, W3, mut ?? ''])
  await pg.reload({ waitUntil: 'domcontentloaded', timeout: 90000 }); await pg.waitForSelector('[data-testid="grid"]'); await pg.locator('.gridwrap').focus(); await sleep(300)
}
async function go(pg, id = 'R013', view = 9) { await pg.keyboard.press(`Alt+${view}`); await sleep(80); await pg.keyboard.press('Control+g'); await pg.getByTestId('prompt-text').fill(id); await pg.keyboard.press('Enter'); await sleep(150); return (await state(pg)).cursor }
// W0: ステータスバーの案内「（元の商社に取り下げを伝えたら x）」どおり x（カーソルは編集できる単価の列）
await reset(env, { role: 'purchasing' }); await setup(A)
let cur0 = await go(A)
await A.keyboard.press('x'); await sleep(150); const st0 = await state(A); await A.keyboard.press('Enter'); await sleep(200)
log({ name: 'W0 案内どおり x → Enter', cur: cur0, afterX: st0, fw: await fw(A), toast: await toastOf(A), price: await A.evaluate((k) => { const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); return p.quotes.filter((q) => q.rowId === 'R013').map((q) => q.supplierId + ':' + q.unitPrice) }, LSK) })
await A.keyboard.press('Escape')
// W1: Alt+x を速く（間 0ms）
await reset(env, { role: 'purchasing' }); await setup(A)
let cur = await go(A)
const seq = []
for (let i = 0; i < 3; i++) { await A.keyboard.press('Alt+x'); seq.push({ after: i + 1, fw: await fw(A), toast: await toastOf(A), cursor: (await state(A)).cursor }) }
await A.keyboard.press('Alt+x'); seq.push({ after: 4, fw: await fw(A), toast: await toastOf(A) })
log({ name: 'W1 Alt+x を 4 回続けて（ビュー 9）', cur, seq })
// W2: Ctrl+Z 3 回 → Ctrl+Y 1 回 → リロード
const z = []
for (let i = 0; i < 3; i++) { await A.keyboard.press('Control+z'); await sleep(120); z.push({ fw: await fw(A), toast: await toastOf(A) }) }
await A.keyboard.press('Control+y'); await sleep(120); z.push({ y: true, fw: await fw(A), toast: await toastOf(A) })
await A.reload({ waitUntil: 'domcontentloaded', timeout: 90000 }); await A.waitForSelector('[data-testid="grid"]'); await A.locator('.gridwrap').focus(); await sleep(300)
z.push({ reload: true, fw: await fw(A) })
await go(A); await A.keyboard.press('Control+z'); await sleep(150); z.push({ zAfterReload: true, fw: await fw(A), toast: await toastOf(A) })
log({ name: 'W2 Ctrl+Z×3・Ctrl+Y・リロード・Ctrl+Z', z })
// W3: 2 タブ。A が x、すぐに B が x（B は同じ行に居る）
await reset(env, { role: 'purchasing' }); await setup(A)
const B = await env.context.newPage(); await B.goto(env.url); await B.waitForSelector('[data-testid="grid"]'); await B.locator('.gridwrap').focus(); await sleep(300)
await go(A); await go(B)
for (const gap of [0, 30, 400]) {
  await setup(A); await go(A); await B.reload({ waitUntil: 'domcontentloaded', timeout: 90000 }); await B.waitForSelector('[data-testid="grid"]'); await B.locator('.gridwrap').focus(); await go(B); await sleep(200)
  await A.keyboard.press('Alt+x'); if (gap) await sleep(gap); await B.keyboard.press('Alt+x'); await sleep(600)
  log({ name: `W3 2 タブ: A の Alt+x の ${gap}ms 後に B の Alt+x`, fwA: await fw(A), fwB: await fw(B), toastA: await toastOf(A), toastB: await toastOf(B), expect: '商社C FR-3 だけ残る（2 社を伝えた）' })
}
await B.close()
// W4: 取り消した行（取消済）にも取下げの印。ビュー 9 に出て x で外せるか
await reset(env, { role: 'purchasing' }); await setup(A, 'cancel')
cur = await go(A)
const shown9 = await A.evaluate(() => !!document.querySelector('[data-testid="grid"] [data-row-id="R013"]'))
await A.keyboard.press('Alt+x'); await sleep(150)
log({ name: 'W4 取消済の行の取下げをビュー 9 で Alt+x', cur, shown9, fw: await fw(A), toast: await toastOf(A) })
// W5: 設計の役割で x（購買の印なので何もしない／何と言うか）
await reset(env, { role: 'design' }); await setup(A)
cur = await go(A, 'R013', 1)
await A.keyboard.press('Alt+x'); await sleep(150)
log({ name: 'W5 設計で R013 に Alt+x', cur, fw: await fw(A), toast: await toastOf(A) })
log({ name: 'console/pageerror', errs: env.errs.slice(0, 20) })
log.save(); await env.browser.close()
