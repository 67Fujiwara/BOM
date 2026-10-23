// 型の違う項目を含む JSON（他ツール・手修正を想定）: どの項目で画面が壊れるか、壊れたあとリロード・復旧できるか
import { launch, fresh, setRole, sleep, dumpErrors, save, panel, closeAll, palette, toastNow, ws, shot, LS_KEY } from './lib.mjs'
const { browser, page, errors } = await launch()
const out = {}
const crash = async () => page.getByTestId('crash').count()
async function importJson(text) {
  await palette(page, 'JSON を読み込む'); await sleep(40)
  await page.evaluate((t) => { const el = document.querySelector('[data-testid="import-text"]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, t); el.dispatchEvent(new Event('input', { bubbles: true })) }, text)
  await page.getByTestId('import-text').focus()
  await page.keyboard.press('Control+Enter'); await sleep(60)
  if (await panel(page)) { await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await sleep(80) }
  return (await toastNow(page)).slice(0, 160)
}
const base = { id: 'R001', name: '部品', model: 'M-1', maker: 'オムロン', qtyNeeded: 1, unit: '個', category: '制御' }
const fields = { name: [123, null, {}, ['a']], model: [null, 5, {}], maker: [['x'], {}], qtyNeeded: ['abc', null, {}, -1], unit: [5, {}], status: ['zzz', 5], category: [{}, 5, ['a']], flags: [null, 'x', 5], history: ['x', 5], working: ['oops', 5, { name: {} }], ackRules: ['x'], note: [{}, 5], ref: [{}, 7], needDateFixed: ['2026-13-45', 5], adoptedSupplierId: ['ZZZ', 5], hidden: ['yes'], ordered: ['no'] }
const res = []
for (const [f, vals] of Object.entries(fields)) {
  for (const v of vals) {
    await fresh(page)
    const n = errors.length
    const t = await importJson(JSON.stringify({ projects: [{ id: 'T', rows: [{ ...base, [f]: v }, { ...base, id: 'R002' }] }] }))
    let where = null
    await page.locator('.gridwrap').focus().catch(() => {})
    outer: for (const role of ['design', 'purchasing', 'pm']) {
      if (await crash()) { where = 'after import'; break }
      await setRole(page, role).catch(() => {})
      for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '1', 'Control+ArrowUp', 'ArrowDown', 'Space', 'Space', 'Control+Shift+C', 'n', 's', 'Shift+S', 'c', 'Escape', 'Enter', 'Escape']) {
        await page.keyboard.press(k).catch(() => {}); await sleep(8)
        if (await crash()) { where = `${role}:${k}`; break outer }
      }
    }
    const pe = errors.slice(n).filter((e) => e.type === 'pageerror' || e.type === 'error').map((e) => e.text.replace(/\s+/g, ' ').slice(0, 120))
    if (where || pe.length) res.push({ field: f, value: v, toast: t.slice(0, 60), crashAt: where, err: pe[0] })
  }
}
out.fieldCrashes = res
console.log(JSON.stringify(res, null, 1))
// suppliers に null
{
  await fresh(page)
  const t = await importJson(JSON.stringify({ projects: [{ id: 'S', rows: [base] }], suppliers: [null, { id: 'S1', name: '因幡電機' }] }))
  const c1 = await crash()
  await page.reload(); await page.waitForSelector('[data-testid="grid"], [data-testid="crash"]'); await sleep(150)
  const c2 = await crash()
  const crashButtons = c2 ? await page.locator('[data-testid="crash"] button').allTextContents() : []
  out.suppliersNull = { toast: t, crashAfterImport: c1, crashAfterReload: c2, crashButtons }
  await shot(page, '03-crash-suppliers-null')
  // 復旧: 「サンプルに戻す」→ Ctrl+K「読み込み前に戻す」で、読み込む前（サンプル）に戻るか / 退避は読み込み前のまま残っているか
  const bk0 = await page.evaluate(() => JSON.parse(localStorage.getItem('bom-pro.workspace.backup') ?? 'null')?.reason)
  if (c2) {
    await page.locator('[data-testid="crash"] button', { hasText: 'サンプルに戻す' }).click().catch(() => {})
    await sleep(400)
  }
  const afterReset = { crash: await crash(), ids: (await ws(page))?.projects.map((p) => p.id), backupReason: await page.evaluate(() => JSON.parse(localStorage.getItem('bom-pro.workspace.backup') ?? 'null')?.reason) }
  out.suppliersNull.recovery = { backupBefore: bk0, afterReset, dialogs: errors.filter((e) => e.type === 'dialog').map((e) => e.text.slice(0, 80)) }
  console.log('suppliersNull', JSON.stringify(out.suppliersNull))
}
save('03-malformed.json', out)
dumpErrors(errors, '03')
await browser.close()
