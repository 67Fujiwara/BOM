// ラウンド4: パレットに出る名前を「そのまま」打つ（3 役割 × 全項目＋行の操作）。先頭に同じ項目が出るか、Enter で何が起きるか
import { launch, fresh, setRole, goto, sleep, dumpErrors, save, panel, closeAll, toastNow, storeState } from './lib.mjs'
const { browser, page, errors } = await launch()
const out = { roles: {}, rowItems: [] }
const REG = `(() => { const r = performance.getEntriesByType('resource').map((e) => e.name).filter((n) => n.includes('/src/commands/registry.ts')); return r.at(-1) ?? '/src/commands/registry.ts' })()`
const allLabels = () => page.evaluate(async (u) => { const m = await import(eval(u)); const set = new Map(); for (const q of ['', 'a', 'i', 'u', 'e', 'o', 'を', 'る', 'す', 'し', 'の', '行', '見積', '設定', 'ビュー', 'json', 'excel', '案件', '指摘', '採用', '公開', '商社', '退避', '表示', '切替']) for (const it of m.paletteItems(q)) if (!/^R\d{3}$/.test(it.section) && it.section !== '案件') set.set(it.label, it.id); return [...set.entries()] }, REG)
async function firstFor(q) {
  await page.keyboard.press('Control+k')
  await page.getByTestId('palette-input').fill(q)
  await sleep(15)
  const items = await page.evaluate(() => [...document.querySelectorAll('[data-testid="palette-list"] .item')].map((el) => el.children[1]?.textContent ?? el.textContent))
  await page.keyboard.press('Escape')
  return items
}
for (const role of ['design', 'purchasing', 'pm']) {
  await fresh(page, role)
  const labels = await allLabels()
  const bad = []
  for (const [label] of labels) {
    const items = await firstFor(label)
    if (!items[0] || !items[0].startsWith(label)) bad.push({ label, first: items[0] ?? null, n: items.length })
    // 空白なし・全角英数でも
  }
  out.roles[role] = { total: labels.length, notFirst: bad }
  console.log(role, labels.length, 'notFirst', bad.length, JSON.stringify(bad).slice(0, 800))
}
// 行の操作: 表示されるラベルをそのまま打つ
await fresh(page)
await page.keyboard.press('1')
for (const q of ['R040', 'R040 置換', 'R040 を置換', 'R040 を隠す', 'R040 へジャンプ', 'R040 採用', 'R040 を 因幡電機 で採用', '40 採用', 'r40 隠す', 'R040を置換']) {
  const items = await firstFor(q)
  out.rowItems.push({ q, first3: items.slice(0, 3), n: items.length })
  console.log('row', JSON.stringify(q), '→', items.length, JSON.stringify(items.slice(0, 3)))
}
// Enter で実行したら何が起きるか（ラベルそのままの「R040 を隠す」）
{
  await fresh(page); await page.keyboard.press('1')
  await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('R040 を隠す'); await sleep(15); await page.keyboard.press('Enter'); await sleep(80)
  const st = await storeState(page, (s) => ({ hidden: s.project().rows.filter((r) => r.hidden).map((r) => r.id), panel: s.panel?.kind ?? null }))
  out.enterExactRowLabel = { ...st, toast: (await toastNow(page)).slice(0, 100) }
  console.log('enter "R040 を隠す"', JSON.stringify(out.enterExactRowLabel))
}
save('25-palette.json', out)
dumpErrors(errors, '25')
await browser.close()
