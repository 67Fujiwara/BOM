// ラウンド20: localStorage がほぼ満杯のとき、ガイドで 300 行の案件を作る（途中まで作られないか・画面が壊れないか・再読み込み後の中身）
import { launch, fresh, sleep, toastNow, ws, wizardCreate, panel, closeAll } from '../r8/rerun7/rerun6/lib.mjs'
import { saveJson } from './lib21.mjs'
const lines = ['部品名\t型式\t変更後型式\tメーカ\t数量']
for (let k = 1; k <= 300; k++) lines.push(`部品${k}\tOLD-${k}\t${k <= 170 ? `OLD-${k}` : k <= 210 ? `NEW-${k}` : ''}\tオムロン\t${(k % 7) + 1}`)
const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 600)) }
for (const headroom of [2000, 40000, 120000, 400000]) {
  const { browser, page, errors } = await launch()
  await fresh(page)
  // fresh は Storage.prototype.setItem を空にするので、新しく読み込み直す
  await page.goto(process.env.BOM_URL ?? 'http://localhost:5176/'); await page.waitForSelector('[data-testid="grid"]')
  const fill = await page.evaluate((headroom) => {
    // 満杯まで詰めて、headroom 文字だけ空ける
    const k = 'zz.filler'; let n = 0; let chunk = 200000
    try { localStorage.removeItem(k) } catch {}
    let s = ''
    while (chunk >= 1) { try { localStorage.setItem(k, s + 'x'.repeat(chunk)); s += 'x'.repeat(chunk); n += chunk } catch { chunk = Math.floor(chunk / 2) } }
    const keep = s.slice(0, Math.max(0, s.length - headroom)); localStorage.setItem(k, keep)
    let used = 0; for (let i = 0; i < localStorage.length; i++) used += (localStorage.key(i).length + localStorage.getItem(localStorage.key(i)).length) * 2
    return { filler: keep.length, usedBytes: used }
  }, headroom)
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('bom-pro.workspace.v2') ?? 'null')?.projects?.length ?? null)
  let r
  try { r = await wizardCreate(page, 'P-ST1', lines.join('\n')) } catch (e) { r = { error: String(e).slice(0, 100) } }
  await sleep(300)
  const toast = (await toastNow(page)).slice(0, 260)
  const pn = await panel(page)
  const state = await page.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2') ?? 'null'); return w ? { projects: w.projects.length, cur: w.projects.find((x) => x.id === w.currentProjectId)?.id, rows: w.projects.find((x) => x.id === w.currentProjectId)?.rows.length } : null })
  const inMem = await page.evaluate(() => document.querySelectorAll('.gridwrap tr.row').length)
  await page.reload().catch(() => {}); await page.waitForSelector('[data-testid="grid"]', { timeout: 15000 }).catch(() => {})
  const afterReload = await page.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2') ?? 'null'); return w ? { projects: w.projects.length, cur: w.currentProjectId, rows: w.projects.find((x) => x.id === w.currentProjectId)?.rows.length } : null })
  log({ headroom, fill, before, wizard: r, toast, panel: pn, state, gridRowsRendered: inMem, afterReload, errs: errors.filter((e) => e.type !== 'dialog').slice(0, 3).map((e) => e.text.slice(0, 160)) })
  await browser.close()
}
saveJson(`162-storage-wizard${process.env.RUN ?? ''}.json`, out)
