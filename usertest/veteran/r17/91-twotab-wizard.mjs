// ラウンド14: 2 つのタブで同時に新しい BOM を作る（同じ案件 ID・ID を空にして自動の ID）。重複した案件 ID ができると、JSON の書き出し → 読み込みで戻せない
import { launch, fresh, palette, sleep, toastNow, ws } from '../r8/rerun7/rerun6/lib.mjs'
import { saveJson } from './lib17.mjs'
const TAG = process.env.TAG ?? ''
const { browser, context, page: A, errors } = await launch()
const out = []
const toPreview = async (pg, id) => { await pg.locator('.gridwrap').focus(); await palette(pg, '新しいBOM'); await sleep(80); await pg.getByTestId('wizard-id').fill(id); await pg.keyboard.press('Enter'); for (let i = 0; i < 6; i++) { await pg.keyboard.press('Enter'); await sleep(30) } await pg.keyboard.press('1'); await sleep(60); await pg.getByTestId('wizard-paste').fill('部品名\t型式\t数量\nリレー\tMY4N\t2'); await pg.getByTestId('wizard-paste').focus(); await pg.keyboard.press('Control+Enter'); await sleep(250) }
const projIds = async (pg) => { const w = await ws(pg); return w?.projects.map((p) => p.id) }
for (const [name, idA, idB] of [['T1 同じ ID「P-DUP」', 'P-DUP', 'P-DUP'], ['T2 大文字小文字だけ違う「P-CASE」「p-case」', 'P-CASE', 'p-case'], ['T3 ID を空（自動の ID）', '', '']]) {
  for (let run = 1; run <= 2; run++) {
    await fresh(A); await A.keyboard.press('Control+s'); await sleep(200)
    const B = await context.newPage(); await B.goto(A.url()); await B.waitForSelector('[data-testid="grid"]')
    await toPreview(A, idA); await toPreview(B, idB)
    await B.keyboard.press('Enter'); await sleep(600)
    const tB = await toastNow(B)
    await A.bringToFront(); await sleep(300)
    await A.keyboard.press('Enter'); await sleep(600)
    const tA = await toastNow(A)
    const ids = await projIds(A)
    // JSON の書き出しの中身をそのまま読み込み直す
    const raw = await A.evaluate(() => localStorage.getItem('bom-pro.workspace.v2'))
    await A.locator('.gridwrap').focus()
    await A.keyboard.press('Control+k'); await A.getByTestId('palette-input').fill('JSON を読み込む'); await sleep(80); await A.keyboard.press('Enter'); await sleep(150)
    await A.evaluate((t) => { const el = document.querySelector('[data-testid="import-text"]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, t); el.dispatchEvent(new Event('input', { bubbles: true })) }, raw)
    await A.getByTestId('import-text').focus(); await A.keyboard.press('Control+Enter'); await sleep(300)
    if (await A.evaluate(() => !!document.querySelector('[data-testid="panel-prompt"]'))) { await A.keyboard.press('2'); await sleep(400) }
    const tImp = await toastNow(A)
    const rec = { name, run, toastB: tB.slice(0, 200), toastA: tA.slice(0, 200), ids, reimport: tImp.slice(0, 250) }
    out.push(rec); console.log(JSON.stringify(rec))
    await A.keyboard.press('Escape'); await B.close()
  }
}
out.push({ errors: errors.filter((e) => e.type !== 'dialog').slice(0, 10) })
saveJson(`91-twotab-wizard${TAG}.json`, out)
await browser.close()
