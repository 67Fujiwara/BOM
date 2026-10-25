// ラウンド9 再実行（元はラウンド7）: 表への大きな貼り付け（Ctrl+V）300 / 1,000 / 2,500 行 × 4 列と、その Ctrl+Z / Ctrl+Y の時間（ビルド）。
// 貼り付けた行の数・最初と最後の値・Undo で元の行数に戻るか。続けて 2,500 行の状態で値 → Enter を 20 回
import { open, reset, gotoCell, snap, sleep, saveJson } from './lib19.mjs'
const port = Number(process.env.PORT ?? 5197)
const env = await open(port); const pg = env.page; const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 700)) }
const count = () => pg.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); return { n: p.rows.length, last: p.rows.at(-1)?.working?.name ?? p.rows.at(-1)?.name, lastModel: p.rows.at(-1)?.working?.model ?? p.rows.at(-1)?.model } })
await env.context.grantPermissions(['clipboard-read', 'clipboard-write'])
for (const N of [300, 1000, 2500]) {
  await reset(env); await gotoCell(pg, 1, 'R080', '部品名')
  const tsv = Array.from({ length: N }, (_, i) => `貼付${i}\tPM-${i}\tオムロン\t${(i % 9) + 1}`).join('\n')
  await pg.evaluate((t) => navigator.clipboard.writeText(t), tsv)
  const c0 = await count()
  let t = Date.now(); await pg.keyboard.press('Control+v'); await pg.waitForFunction((n0) => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); return p.rows.length !== n0 }, c0.n, { timeout: 60000 }).catch(() => {}); const msPaste = Date.now() - t
  await sleep(200)
  const s1 = await snap(pg); const c1 = await count()
  t = Date.now(); await pg.keyboard.press('Control+z'); await pg.waitForFunction((n1) => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); return p.rows.length !== n1 }, c1.n, { timeout: 60000 }).catch(() => {}); const msUndo = Date.now() - t
  const c2 = await count()
  t = Date.now(); await pg.keyboard.press('Control+y'); await pg.waitForFunction((n2) => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); return p.rows.length !== n2 }, c2.n, { timeout: 60000 }).catch(() => {}); const msRedo = Date.now() - t
  const c3 = await count()
  // その状態で 値 → Enter を 20 回（部品名）
  await pg.keyboard.press('Control+g'); await pg.getByTestId('prompt-text').fill('R040'); await pg.keyboard.press('Enter'); await sleep(50)
  await pg.keyboard.press('Home'); for (let i = 0; i < 20 && !(await snap(pg)).cursor.endsWith('部品名'); i++) await pg.keyboard.press('ArrowRight')
  t = Date.now(); for (let i = 0; i < 20; i++) { await pg.keyboard.type('E' + i); await pg.keyboard.press('Enter') } const msEnter = Math.round((Date.now() - t) / 20)
  t = Date.now(); for (let i = 0; i < 5; i++) await pg.keyboard.press('Control+z'); const msZ = Math.round((Date.now() - t) / 5)
  log({ N, before: c0, afterPaste: c1, msPaste, toast: s1.toast.slice(0, 90), afterUndo: c2, msUndo, afterRedo: c3, msRedo, perEnterAfter: msEnter, perUndoAfter: msZ, errs: env.errs.slice(-3) })
}
saveJson(`78-paste-${port}.json`, out); await env.browser.close()
