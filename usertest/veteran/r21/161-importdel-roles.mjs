// ラウンド20: 【削除？】の行（設計の取り込み）が購買・PM の画面でどう見えるか（4 要確認、F8、Ctrl+.、公開）
import { launch, fresh, sleep, toastNow, ws, wizardCreate, panel, closeAll, setRole } from '../r8/rerun7/rerun6/lib.mjs'
import { saveJson } from './lib21.mjs'
const lines = ['部品名\t型式\t変更後型式\tメーカ\t数量']
for (let k = 1; k <= 12; k++) lines.push(`部品${k}\tOLD-${k}\t${k <= 6 ? `OLD-${k}` : k <= 8 ? `NEW-${k}` : ''}\tオムロン\t${(k % 7) + 1}`)
const { browser, page, errors } = await launch()
await fresh(page)
const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 600)) }
await wizardCreate(page, 'P-DEL4', lines.join('\n'))
await page.keyboard.press('Escape')
const side = async () => ((await page.getByTestId('side').innerText().catch(() => '')) || '').replace(/\s+/g, ' ').slice(0, 300)
for (const role of ['purchasing', 'pm', 'design']) {
  await setRole(page, role); await sleep(150)
  await page.keyboard.press('Alt+4'); await sleep(150)
  const n = await page.locator('.gridwrap tr.row').count()
  await page.keyboard.press('F8'); await sleep(80)
  const cur = await page.getByTestId('cursor').textContent()
  await page.keyboard.press('Control+.'); await sleep(100)
  const p = await panel(page)
  const t1 = await toastNow(page)
  if (p) await page.keyboard.press('Escape')
  await page.keyboard.press('Control+Enter'); await sleep(250)
  const p2 = await panel(page); const t2 = await toastNow(page)
  const ptxt = p2 ? ((await page.locator('.dialog').first().innerText().catch(() => '')) || '').replace(/\s+/g, ' ').slice(0, 260) : ''
  log({ role, rows4: n, cursor: cur, quickfixPanel: p, toast1: t1.slice(0, 160), publish: { panel: p2, toast: t2.slice(0, 200), text: ptxt }, side: await side() })
  await closeAll(page)
}
saveJson(`161-importdel-roles${process.env.RUN ?? ''}.json`, out)
console.log('errors', JSON.stringify(errors.filter((e) => e.type !== 'dialog').slice(0, 4)))
await browser.close()
