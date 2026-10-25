// ラウンド20: (1) 必要日(前倒し)に正の値（U19-01 の警告 sys.needOffset.plus）の入力の書き方いろいろ
//             (2) 表への貼り付けのセルの trim（V19-18）の境目: 空白だけ・NBSP・全角空白・ゼロ幅・頭の改行・BOM
// 現行 5176 と r19 ビルド 5198
import { open, reset, gotoCell, sleep, logger, state } from './lib22.mjs'
const showColumn = async (pg, label) => {
  await pg.keyboard.press('Control+k'); await pg.getByTestId('palette-input').fill('列の表示'); await sleep(60); await pg.keyboard.press('Enter'); await sleep(150)
  const cols = await pg.locator('[data-testid="columns"] .opt').allTextContents()
  const i = cols.findIndex((c) => c.includes(label))
  if (i >= 0) { for (let k = 0; k < i; k++) await pg.keyboard.press('ArrowDown'); if (cols[i].startsWith('○')) await pg.keyboard.press('Space') }
  await pg.keyboard.press('Escape'); await sleep(60)
  return i >= 0 ? cols[i].slice(0, 20) : false
}
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`157-ui-misc-${port}${process.env.RUN ?? ''}.json`)
await env.context.grantPermissions(['clipboard-read', 'clipboard-write'])
const LSK = 'bom-pro.workspace.v2'
const rowOf = (id) => pg.evaluate(([k, id]) => { const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); const r = p.rows.find((x) => x.id === id); return r ? { name: r.name, model: r.model, maker: r.maker, qty: r.qtyNeeded, note: r.note, needOffset: r.needOffset } : null }, [LSK, id])
const problems = (id) => pg.evaluate(async ([k, id]) => { const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); const r = p.rows.find((x) => x.id === id); const m = await import('/src/model/rules.ts'); return m.checkRow(r, w.rules, p).map((x) => x.ruleId + ':' + x.severity) }, [LSK, id]).catch((e) => ['(import err ' + String(e).slice(0, 60) + ')'])
const toast = () => pg.evaluate(() => (document.querySelector('[data-testid="toast-float"]') ?? document.querySelector('[data-testid="toast"]'))?.textContent?.slice(0, 260) ?? '')
// (1)
for (const v of ['7', '+7', '７', '-7', '−7', '－7', '0', '7日前', '前倒し7', '-7.5', '1e1', '365', '-365', '366']) {
  await reset(env); await pg.locator('.gridwrap').focus(); const shown = await showColumn(pg, '前倒し'); const okc = await gotoCell(pg, 1, 'R011', '必要日(前倒し)')
  if (!okc) { log({ sec: 'needOffset', v, error: 'column-not-reached', shown }); continue }
  await pg.keyboard.press('Enter'); await sleep(60)
  await pg.keyboard.press('Control+a'); await pg.keyboard.type(v); await pg.keyboard.press('Enter'); await sleep(150)
  const r = await rowOf('R011'); const t = await toast(); const pr = await problems('R011')
  await pg.keyboard.press('Space'); await sleep(200)
  const detail = await pg.evaluate(() => (document.querySelector('[data-testid="detail"]') ?? document.querySelector('.detail'))?.textContent?.replace(/\s+/g, ' ').slice(0, 500) ?? '')
  await pg.keyboard.press('Escape')
  log({ sec: 'needOffset', v, needOffset: r?.needOffset, toast: t, problems: pr, plusWarn: /前倒し.*\+|後ろになります/.test(detail), detail: detail.slice(0, 160), errs: env.errs.filter((e) => e.type !== 'dialog').slice(-2).map((e) => e.text.slice(0, 100)) })
}
// 範囲の貼り付け（Ctrl+V）でも同じ警告
await reset(env); await pg.locator('.gridwrap').focus(); await showColumn(pg, '前倒し'); await gotoCell(pg, 1, 'R011', '必要日(前倒し)')
await pg.evaluate((t) => navigator.clipboard.writeText(t), '5\n-5\n12\n'); await pg.keyboard.press('Control+v'); await sleep(300)
log({ sec: 'needOffset-paste', rows: [await rowOf('R011'), await rowOf('R012'), await rowOf('R013')].map((r) => r?.needOffset), problems: [await problems('R011'), await problems('R012'), await problems('R013')], toast: await toast() })
log({ name: 'console/pageerror', errs: env.errs.slice(0, 20) })
log.save(); await env.browser.close()
