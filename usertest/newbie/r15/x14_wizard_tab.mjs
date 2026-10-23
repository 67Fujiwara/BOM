import { launch, fresh, T, makeLog, ui, sleep, shot, palette, proj } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('x14_wizard_tab')
const st = async (tag) => { const u = await ui(page); const a = await page.evaluate(() => { const e = document.activeElement; return `${e?.tagName}.${e?.className}`.slice(0, 60) }); log(`  [${tag}] mode=${u.mode} panel=${u.panel} active=${a} | ${(await page.locator('.wizard h3, [data-testid=wizard] h3').first().innerText().catch(() => '-'))} | toast: ${await T.toast(page)}`) }
for (const how of ['fill', 'keyboard-paste']) {
  log('== ' + how)
  await fresh(page); await palette(page, '新しいBOM'); await page.keyboard.press('Enter'); await sleep(150); for (let i = 0; i < 7; i++) await page.keyboard.press('Enter'); await sleep(50); await st('step8')
  await page.keyboard.press('1'); await sleep(80); await st('1')
  const text = 'リレー\tMY4N\tオムロン\t4\nタイマ\tH3CR\tオムロン\t2'
  if (how === 'fill') await page.getByTestId('wizard-paste').fill(text)
  else { await page.getByTestId('wizard-paste').focus(); await page.evaluate((t) => navigator.clipboard.writeText(t), text); await page.keyboard.press('Control+v') }
  await sleep(80); await st('pasted')
  await page.keyboard.press('Tab'); await sleep(80); await st('Tab')
  await page.keyboard.press('Enter'); await sleep(150); await st('Enter')
  await page.keyboard.press('Enter'); await sleep(150); await st('Enter2')
  const p = await proj(page); log('  project', p.id, p.rows.length)
}
save(errors); await browser.close()
