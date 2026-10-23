// ラウンド7: 問題を直した（値を直して Enter）直後の F8 はどこへ行くか。R005 の型式（前後の空白）を直して F8
import { open, reset, gotoCell, snap, sleep, saveJson } from './lib7.mjs'
const env = await open(Number(process.env.PORT ?? 5176)); const pg = env.page; const out = []
await reset(env); await gotoCell(pg, 4, 'R005', '型式')
const a = await snap(pg)
const model = await pg.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); const r = p.rows.find((x) => x.id === 'R005'); return r.working?.model ?? r.model })
await pg.keyboard.press('F2'); await pg.keyboard.press('Control+a'); await pg.keyboard.type(model.trim()); await pg.keyboard.press('Escape'); await sleep(50)
await pg.keyboard.press('F2'); await pg.keyboard.press('Control+a'); await pg.keyboard.type(model.trim()); await pg.keyboard.press('Tab'); await sleep(80)
await pg.keyboard.press('Shift+Tab'); await sleep(50)
const b = await snap(pg)
await pg.keyboard.press('F8'); await sleep(80)
const c = await snap(pg)
const rec = { model: JSON.stringify(model), start: a.cursor, afterFix: b.cursor, afterF8: c.cursor, expectedNext: 'R061 型式（一覧で R005 の次）', toast: c.toast.slice(0, 60) }
console.log(JSON.stringify(rec)); out.push(rec)
saveJson('74b-fixjump.json', out); await env.browser.close()
