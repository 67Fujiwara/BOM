import { launch, fresh, T, makeLog, proj, sleep, typeReal } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t41_due')
for (const due of ['2026/12/20', '12/20', 'R8.12.20', '来月末']) {
  await fresh(page)
  await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('新しいBOM'); await sleep(60); await page.keyboard.press('Enter'); await page.getByTestId('wizard').waitFor()
  await page.getByTestId('wizard-id').fill('DUE-1'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter')
  await typeReal(page, due, 20); await page.keyboard.press('Enter'); await sleep(80)
  const pt = (await T.panelText(page))?.slice(0, 120); const t = await T.toast(page)
  for (let i = 0; i < 5; i++) await page.keyboard.press('Enter')
  await page.keyboard.press('3'); await page.keyboard.press('Enter'); await sleep(80); const conf = (await T.panelText(page))?.match(/納期 [^/]+/)?.[0]
  await page.keyboard.press('Enter'); await sleep(200)
  const p = await proj(page); log(`due "${due}" -> step: ${pt} | toast ${t} | confirm ${conf} | stored ${p.id} dueDate=${p.dueDate} | header ${(await T.header(page)).slice(0, 80)}`)
}
save(errors); await browser.close()
