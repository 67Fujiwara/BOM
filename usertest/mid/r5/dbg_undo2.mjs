import { launch, log } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
await t.press('1'); log(await t.setCellKey('R030', 'note', 'U05テスト'))
await page.waitForTimeout(1000)
await page.reload(); await page.waitForTimeout(800)
log(await page.evaluate(async () => {
  const raw = sessionStorage.getItem('bom-pro.history')
  let parsed = null; try { parsed = Object.keys(JSON.parse(raw).undo) } catch (e) { parsed = 'ERR ' + e.message }
  const ents = performance.getEntriesByType('resource').map((x) => x.name).filter((n) => n.includes('store.ts'))
  const m = await import(window.__m('/src/model/store.ts'))
  return { len: raw?.length, parsed, ents, undo: Object.keys(m.useStore.getState().undo) }
}))
await t.close()
