// ラウンド15 の共通: ガイドで貼り付け／ファイルから BOM を作る、行の問題を読む
import { T, shot, proj, palette, sleep, fresh } from './lib.mjs'
export async function openWizard(page) {
  await fresh(page); await palette(page, '新しいBOM'); await page.keyboard.press('Enter'); await page.getByTestId('wizard').waitFor()
  for (let i = 0; i < 7; i++) await page.keyboard.press('Enter')
}
export async function preview(page) {
  return (await page.getByTestId('wizard-preview').innerText().catch(() => '-')).replace(/\s+/g, ' ').replace(/^.*?取り込む行/, '取り込む行').replace(/Enter で作成.*$/, '')
}
export async function wizardPaste(page, text) {
  await openWizard(page)
  await page.keyboard.press('1'); await sleep(80)
  await page.getByTestId('wizard-paste').fill(text); await sleep(80)
  await page.keyboard.press('Control+Enter'); await sleep(250)
  return preview(page)
}
export async function wizardFile(page, file) {
  await openWizard(page)
  await page.keyboard.press('2'); await sleep(80)
  await page.getByTestId('wizard-file').setInputFiles(file); await sleep(1500)
  const t = await T.toast(page)
  await page.keyboard.press('Enter'); await sleep(250)
  return { toast: t, pv: await preview(page) }
}
export const rowsText = (p) => p.rows.map((r) => `{${r.category}|${r.ref}|${r.name}|${r.model}|${r.maker}|${r.qtyNeeded}${r.unit}|${r.note}}`).join(' ')
export const probs = (page) => page.evaluate(async () => {
  const find = (k) => performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes(k)) ?? k
  const s = (await import(find('/src/model/store.ts'))).useStore.getState()
  const R = await import(find('/src/model/rules.ts'))
  const p = s.ws.projects.find((x) => x.id === s.ws.currentProjectId)
  return p.rows.map((r) => `${r.id}:` + R.checkRow(r, s.ws.rules, p).map((x) => `${x.severity[0]}/${x.field}/${x.message.slice(0, 30)}`).join(';')).filter((x) => !/:$/.test(x)).join(' | ') || '(問題なし)'
})
/** 作成 → 行 → 問題 → Ctrl+Enter（最初の公開）。公開した行の状態も */
export async function createAndPublish(page, log, tag) {
  await page.keyboard.press('Enter'); await sleep(350)
  const p = await proj(page)
  log(`   created rows=${p.rows.length}: ${rowsText(p)}`)
  log(`   toast=${await T.toast(page)}`)
  log(`   problems: ${await probs(page)}`)
  await page.keyboard.press('Control+Enter'); await sleep(300)
  log(`   Ctrl+Enter -> ${await T.toast(page)} | panel ${(await T.panelText(page))?.slice(0, 120) ?? '-'}`)
  if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(80) }
  const p2 = await proj(page)
  log(`   published: ${p2.rows.map((r) => `${r.id}:${r.status}:rev${r.publishedRev ?? '-'}`).join(' ')}`)
  if (tag) await shot(page, tag)
  return p2
}
