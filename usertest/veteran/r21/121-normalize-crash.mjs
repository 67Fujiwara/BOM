// ラウンド17: 起動時・JSON の読み込み時の normalize（ラウンド16 の M16-03）が、sanitize を通った JSON で例外を出す形（120-normalize-fuzz で見つけた形）を画面で。
// 商社マスタで S1 を取引停止（M16-03 と同じ操作）＋ 正式見積済 R013（S1 採用・正式依頼No あり）の flags.formalWithdrawn が文字でない（false・true・0・{}）
import { open, reset, sleep, logger } from './lib21.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`121-normalize-crash-${port}${process.env.RUN ?? ''}.json`)
const LSK = 'bom-pro.workspace.v2'
const toast = () => pg.evaluate(() => (document.querySelector('[data-testid="toast-float"]') ?? document.querySelector('[data-testid="toast"]'))?.textContent?.slice(0, 400) ?? '')
await reset(env)
const base = await pg.evaluate((k) => JSON.parse(localStorage.getItem(k)), LSK)
const craft = (fw, stop = true) => {
  const w = structuredClone(base); const p = w.projects.find((x) => x.id === w.currentProjectId)
  if (stop) w.suppliers.find((s) => s.id === 'S1').tradable = false
  const r = p.rows.find((x) => x.id === 'R013')
  if (fw === undefined) delete r.flags.formalWithdrawn
  else r.flags.formalWithdrawn = fw
  return w
}
const look = async () => pg.evaluate((k) => {
  const w = JSON.parse(localStorage.getItem(k) ?? 'null'); const p = w?.projects.find((x) => x.id === w.currentProjectId); const r = p?.rows.find((x) => x.id === 'R013')
  return { grid: !!document.querySelector('[data-testid="grid"]'), rootChildren: document.getElementById('root')?.childElementCount ?? -1, bodyText: document.body.innerText.slice(0, 120), stored013: r ? { status: r.status, adopted: r.adoptedSupplierId ?? null, fw: r.flags.formalWithdrawn ?? null } : null, shown013: document.querySelector('[data-testid="grid"] [data-row-id="R013"]')?.textContent?.replace(/\s+/g, ' ').slice(0, 120) ?? null }
}, LSK)
// --- 起動時（保存データをそのまま置いてリロード） ---
for (const [name, fw, stop] of [['S0 対照: 取引停止だけ（formalWithdrawn なし）', undefined, true], ['S1 formalWithdrawn=false', false, true], ['S2 formalWithdrawn=true', true, true], ['S3 formalWithdrawn=0', 0, true], ['S4 formalWithdrawn={}', {}, true], ['S5 対照: formalWithdrawn=false・取引停止なし', false, false]]) {
  await reset(env); env.errs.length = 0
  await pg.evaluate(([k, w]) => localStorage.setItem(k, JSON.stringify(w)), [LSK, craft(fw, stop)])
  await pg.reload(); await sleep(1500)
  const a = await look()
  // もう一度リロード（同じデータが残るので毎回同じか）
  await pg.reload(); await sleep(1200)
  const b = await look()
  log({ name, first: a, second: b, errs: env.errs.slice(0, 4) })
}
// --- JSON の読み込み（Ctrl+K → JSON を読み込む に貼る） ---
for (const [name, fw] of [['J0 対照: 取引停止だけ', undefined], ['J1 formalWithdrawn=false', false], ['J2 formalWithdrawn=true', true]]) {
  await reset(env); env.errs.length = 0
  const before = await pg.evaluate((k) => localStorage.getItem(k).length, LSK)
  await pg.keyboard.press('Control+k'); await pg.getByTestId('palette-input').fill('JSON を読み込む'); await sleep(80); await pg.keyboard.press('Enter'); await sleep(150)
  const text = JSON.stringify(craft(fw))
  await pg.evaluate((t) => { const el = document.querySelector('[data-testid="import-text"]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, t); el.dispatchEvent(new Event('input', { bubbles: true })) }, text)
  await pg.getByTestId('import-text').focus(); await pg.keyboard.press('Control+Enter'); await sleep(300)
  const prompt = await pg.evaluate(() => !!document.querySelector('[data-testid="panel-prompt"]'))
  if (prompt) { await pg.keyboard.press('2'); await sleep(400) }
  const t = await toast()
  const panel = await pg.evaluate(() => document.querySelector('[data-testid^="panel-"]')?.dataset.testid ?? null)
  const after = await look()
  const sameStorage = (await pg.evaluate((k) => localStorage.getItem(k).length, LSK)) === before
  // 読み込みのあと、表はまだ動くか（↓ と Esc）
  await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape'); await pg.locator('.gridwrap').focus().catch(() => {}); await pg.keyboard.press('ArrowDown'); await sleep(100)
  const cursor = await pg.evaluate(() => document.querySelector('[data-testid="cursor"]')?.textContent ?? '')
  log({ name, prompt, toast: t, panel, after, sameStorageLength: sameStorage, cursorAfter: cursor, errs: env.errs.slice(0, 4) })
}
log({ name: 'console/pageerror', errs: env.errs.slice(0, 20) })
log.save(); await env.browser.close()
