// ラウンド21: 【削除？】の案内「備考の列は Ctrl+K →「列の表示」で出せます」を、ビュー 4・1・2 で試す
import { launch, T, makeLog, ui, sleep, proj, palette } from './lib.mjs'
import { wizardPaste } from './w15.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 'r84_note_col21')
const hdr = async () => (await page.locator('thead th').allInnerTexts()).join('|')
await wizardPaste(page, `品名\t型式（旧）\t型式（新）\tメーカー\t数量\nリレー\tMY2N\tMY4N-D2\tオムロン\t2\nC1\tC-1\tC-1\tオムロン\t1\nC2\tC-2\tC-2\tオムロン\t1\nE1\tE-1\t\tオムロン\t1\nE2\tE-2\t\tオムロン\t1\nE3\tE-3\t\tオムロン\t1`)
await page.keyboard.press('Enter'); await sleep(400)
await page.keyboard.press('Control+Enter'); await sleep(400)
if (await T.panel(page)) await page.keyboard.press('Escape')
await page.locator('.gridwrap').focus()
log('view after create: ' + (await ui(page)).view + ' header: ' + await hdr())
async function toggleNote() {
  await palette(page, '列の表示'); await page.keyboard.press('Enter'); await sleep(250)
  const items = await page.getByTestId('columns').locator('.opt').allTextContents()
  const bi = items.findIndex((t) => t.includes('備考'))
  const before = items[bi]
  for (let k = 0; k < bi; k++) await page.keyboard.press('ArrowDown')
  await page.keyboard.press(' '); await sleep(150)
  const after = (await page.getByTestId('columns').locator('.opt').allTextContents())[bi]
  await page.keyboard.press('Escape'); await sleep(150)
  return `${before} -> ${after}`
}
log('view4 toggle: ' + await toggleNote() + ' | header: ' + await hdr() + ' | hiddenCols=' + JSON.stringify((await ui(page)).hiddenCols))
for (const v of ['1', '2', '9', '4', '5']) { await page.keyboard.press(v); await sleep(250); log(`view ${v}: header: ` + await hdr()) }
log('view5 toggle again: ' + await toggleNote()); await page.keyboard.press('1'); await sleep(200); log('view1: header: ' + await hdr())
save(errors); await browser.close()
