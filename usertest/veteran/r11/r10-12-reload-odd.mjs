// ラウンド10: 変な瞬間のリロード（打って入力中・確定の直後 0ms・貼り付けの直後・矢印で確定した直後・ダイアログ中）→ 値・Undo・カーソル
import { open, reset, sleep, logger, state, gotoCell, typeSeqM } from './lib11.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`12-reload-odd-${port}.json`)
await env.context.grantPermissions(['clipboard-read', 'clipboard-write'])
const val = (id, f) => pg.evaluate(([id, f]) => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); const r = p.rows.find((x) => x.id === id); return { v: r?.working?.[f] ?? r?.[f], n: p.rows.length } }, [id, f])
const reload = async () => { await pg.reload(); await pg.waitForSelector('[data-testid="grid"]'); await pg.locator('.gridwrap').focus(); await sleep(300) }
const after = async (id, f) => { const a = await val(id, f); const s = await state(pg); await pg.keyboard.press('Control+z'); await sleep(200); const z = await val(id, f); return { stored: a, cursor: s.cursor, mode: s.mode, toast: s.toast.slice(0, 100), afterUndo: z } }
{ await reset(env); await gotoCell(pg, 1, 'R010', '部品名'); await pg.keyboard.type('TYPED'); await reload(); log({ case: 'R1 打って入力中にリロード', ...(await after('R010', 'name')) }) }
{ await reset(env); await gotoCell(pg, 1, 'R010', '部品名'); await typeSeqM(pg, [['Q', 0], ['1', 0], ['Enter', 0]]); await reload(); log({ case: 'R2 確定の直後（0ms）にリロード', ...(await after('R010', 'name')) }) }
{ await reset(env); await gotoCell(pg, 1, 'R010', '部品名'); await typeSeqM(pg, [['Q', 0], ['2', 0], ['ArrowRight', 0]]); await reload(); log({ case: 'R3 → で確定した直後にリロード', ...(await after('R010', 'name')) }) }
{ await reset(env); await gotoCell(pg, 1, 'R080', '部品名'); await pg.evaluate((t) => navigator.clipboard.writeText(t), Array.from({ length: 300 }, (_, i) => `P${i}\tM${i}\tX\t1`).join('\n')); await pg.keyboard.press('Control+v'); await reload(); const a = await val('R080', 'name'); await pg.keyboard.press('Control+z'); await sleep(400); const z = await val('R080', 'name'); log({ case: 'R4 300 行貼り付けの直後にリロード → Ctrl+Z', rowsAfterReload: a.n, rowsAfterUndo: z.n, toast: (await state(pg)).toast.slice(0, 100) }) }
{ await reset(env); await gotoCell(pg, 1, 'R004', 'ID'); await pg.keyboard.press('Shift+A'); await sleep(80); await pg.keyboard.press('2'); await sleep(80); await pg.keyboard.press('1'); await pg.keyboard.type('memo'); await reload(); const s = await state(pg); log({ case: 'R5 採用理由のダイアログ中にリロード', panel: s.panel, cursor: s.cursor, adopted: await val('R004', 'adoptedSupplierId') }) }
{ await reset(env); await pg.keyboard.press('Alt+4'); for (let i = 0; i < 8 && !(await state(pg)).cursor.startsWith('R041'); i++) await pg.keyboard.press('F8'); await reload(); const s0 = (await state(pg)).cursor; await pg.keyboard.press('F8'); await sleep(80); log({ case: 'R6 4 で F8 → R041 → リロード → F8', afterReload: s0, afterF8: (await state(pg)).cursor }) }
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
