// ラウンド20: セルの前後の空白。入力（Enter で確定）・1 セルの貼り付け・複数セルの貼り付け（V19-18 で trim した）・F2 で編集して確定。
// 現行 5176 と r19 ビルド 5198
import { open, reset, gotoCell, sleep, logger } from './lib21.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`159-paste-trim-${port}${process.env.RUN ?? ''}.json`)
await env.context.grantPermissions(['clipboard-read', 'clipboard-write'])
const LSK = 'bom-pro.workspace.v2'
const rowOf = (id) => pg.evaluate(([k, id]) => { const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); const r = p.rows.find((x) => x.id === id); return r ? { name: r.name, model: r.model, maker: r.maker, note: r.note, qty: r.qtyNeeded } : null }, [LSK, id])
const toast = () => pg.evaluate(() => (document.querySelector('[data-testid="toast-float"]') ?? document.querySelector('[data-testid="toast"]'))?.textContent?.slice(0, 200) ?? '')
const show = (s) => JSON.stringify(s).replace(/ /g, '<NBSP>').replace(/　/g, '<IDSP>').replace(/​/g, '<ZWSP>').replace(/﻿/g, '<BOM>')
const SAMPLES = { ascii: ' リレーX ', nbsp: ' リレーX ', idsp: '　リレーX　', zwsp: '​リレーX​', tabs: 'リレーX\t' }
for (const [id, val] of Object.entries(SAMPLES)) {
  // 1 セルの貼り付け
  await reset(env); await gotoCell(pg, 1, 'R078', '部品名')
  await pg.evaluate((t) => navigator.clipboard.writeText(t), val + '\n'); await pg.keyboard.press('Control+v'); await sleep(250)
  const a = await rowOf('R078'); log({ mode: 'paste1', id, val: show(val), name: show(a?.name), toast: show(await toast()) })
  // 複数セル（部品名・型式）の貼り付け
  await reset(env); await gotoCell(pg, 1, 'R078', '部品名')
  await pg.evaluate((t) => navigator.clipboard.writeText(t), `${val}\t${val}M\n`); await pg.keyboard.press('Control+v'); await sleep(250)
  const b = await rowOf('R078'); log({ mode: 'paste2', id, val: show(val), name: show(b?.name), model: show(b?.model) })
  // 入力して確定
  await reset(env); await gotoCell(pg, 1, 'R078', '部品名')
  await pg.keyboard.press('Enter'); await sleep(50); await pg.keyboard.press('Control+a'); await pg.keyboard.insertText(val); await pg.keyboard.press('Enter'); await sleep(200)
  const c = await rowOf('R078'); log({ mode: 'edit', id, val: show(val), name: show(c?.name) })
}
// 型式の末尾の空白で別の型式扱いになるか: R078 の型式を 'ABC' と 'ABC ' にして重複・差分を見る
await reset(env); await gotoCell(pg, 1, 'R078', '型式')
await pg.evaluate((t) => navigator.clipboard.writeText(t), 'ZZ-1 \n'); await pg.keyboard.press('Control+v'); await sleep(200)
await pg.keyboard.press('ArrowDown'); await pg.evaluate((t) => navigator.clipboard.writeText(t), 'ZZ-1\n'); await pg.keyboard.press('Control+v'); await sleep(200)
log({ mode: 'dup', r78: show((await rowOf('R078'))?.model), r79: show((await rowOf('R079'))?.model), toast: show(await toast()) })
log({ name: 'console/pageerror', errs: env.errs.slice(0, 20) })
log.save(); await env.browser.close()
