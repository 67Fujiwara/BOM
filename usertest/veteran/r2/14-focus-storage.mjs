// Tab でパネルからフォーカスが抜けたときの影響 / ローカル保存が読めないときのデータ消失
import { launch, fresh, setRole, goto, toCol, cursor, mode, sleep, dumpErrors, save2, proj, panel, closeAll, palette, toastNow, ws, shot2 } from './lib.mjs'
const { browser, page, errors } = await launch()
const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 900)) }
const active = () => page.evaluate(() => document.activeElement?.dataset?.testid ?? document.activeElement?.tagName)
// A: ジャンプ（Ctrl+G）で Tab → 打鍵
await fresh(page)
await page.keyboard.press('Control+g'); await page.keyboard.press('Tab'); const a1 = await active(); await page.keyboard.type('R030'); const v = await page.getByTestId('prompt-text').inputValue(); await page.keyboard.press('Enter'); await sleep(30)
log({ case: 'goto: Tab then type', activeAfterTab: a1, promptValue: v, panel: await panel(page), cursor: await cursor(page), toast: (await toastNow(page)).slice(0, 80) })
await closeAll(page)
// B: パレットで Shift+Tab → 打鍵 → 表の絞り込みに入る？
await page.keyboard.press('Control+k'); await page.keyboard.press('Shift+Tab'); const b1 = await active(); await page.keyboard.type('公開'); const pq = await page.getByTestId('palette-input').inputValue(); const fv = await page.getByTestId('filter').inputValue(); await page.keyboard.press('Enter'); await sleep(30)
log({ case: 'palette: Shift+Tab then type', activeAfter: b1, paletteQuery: pq, gridFilter: fv, panelAfterEnter: await panel(page), rowsShown: await page.getByTestId('row').count(), activeAfterEnter: await active() })
await shot2(page, '14-palette-shifttab')
await closeAll(page); await page.keyboard.press('Escape')
// C: ガイドで Tab（案件名の欄）→ 打鍵
await palette(page, '新しいBOM'); await page.getByTestId('wizard-id').fill('P-TAB'); await page.keyboard.press('Enter'); await page.keyboard.press('Tab'); const c1 = await active(); await page.keyboard.type('タブ後の名前'); const nm = await page.getByTestId('wizard-name').inputValue().catch(() => null)
log({ case: 'wizard: Tab then type', activeAfterTab: c1, nameValue: nm, panel: await panel(page), mode: await mode(page) })
await closeAll(page)
// D: 設定の値編集で Tab
await setRole(page, 'pm'); await palette(page, '案件設定'); await page.keyboard.press('Enter'); await page.keyboard.press('Tab'); const d1 = await active(); await page.keyboard.type('X'); const sv = await page.getByTestId('settings-input').inputValue().catch(() => null)
log({ case: 'settings edit: Tab then type', activeAfterTab: d1, settingValue: sv, panel: await panel(page) })
await closeAll(page)
// E: ローカル保存が検証で弾かれる形（行に id が無い 1 行）→ 再読み込み → 何が表示されるか → 1 回編集 → 保存内容
await fresh(page)
await palette(page, '新しいBOM'); await page.getByTestId('wizard-id').fill('P-MINE'); await page.keyboard.press('Enter'); await page.getByTestId('wizard-name').fill('自分の案件'); await page.keyboard.press('Enter'); for (let i = 0; i < 5; i++) await page.keyboard.press('Enter')
await page.keyboard.press('1'); await page.getByTestId('wizard-paste').fill('品名\t形式\t員数\nリレー\tMY4N\t3\nタイマ\tH3CR\t1'); await page.keyboard.press('Control+Enter'); await page.keyboard.press('Enter'); await sleep(200)
const before = await ws(page)
const mine = before.projects.find((p) => p.id === 'P-MINE')
mine.rows.push({ name: 'id の無い行（別ツールで足した想定）' })
await page.evaluate((s) => localStorage.setItem('bom-pro.workspace.v2', s), JSON.stringify(before))
const n = errors.length
await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await sleep(200)
const shown = { header: (await page.getByTestId('header').textContent()).slice(0, 40), toast: (await toastNow(page)).slice(0, 120), crash: await page.getByTestId('crash').count() }
const lsStill = (await ws(page)).projects.map((p) => p.id)
await page.locator('.gridwrap').focus(); await page.keyboard.press('1'); await goto(page, 'R030'); await toCol(page, '部品名'); await page.keyboard.press('Enter'); await page.keyboard.type('x'); await page.keyboard.press('Enter'); await sleep(100)
const lsAfter = (await ws(page)).projects.map((p) => p.id)
log({ case: 'invalid localStorage → silent sample → overwrite', shownAfterReload: shown, lsProjectsBeforeEdit: lsStill, lsProjectsAfterOneEdit: lsAfter, errors: errors.slice(n).map((e) => e.text.slice(0, 100)) })
await shot2(page, '14-silent-sample')
// F: 壊れた指摘（by:null）が入った JSON を読み込む → 行を開く → 画面が壊れる → 再読み込みで直るか
await fresh(page)
await palette(page, 'JSON を読み込む')
await page.getByTestId('import-text').fill('{"projects":[{"id":"Y","name":"壊れた指摘","rows":[{"id":"R001","name":"a"}],"issues":[{"id":"I1","rowId":"R001","kind":"型式あいまい","status":"open","by":null,"text":"x"}]}]}')
await page.keyboard.press('Control+Enter'); await sleep(150)
const t1 = await toastNow(page)
await page.keyboard.press('1'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Space'); await sleep(100)
const crash1 = await page.getByTestId('crash').count()
const crashText = crash1 ? (await page.getByTestId('crash').textContent()).slice(0, 160) : null
await shot2(page, '14-crash-issue-by-null')
await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus()
await page.keyboard.press('1'); await page.keyboard.press('4'); await sleep(50); const crash2 = await page.getByTestId('crash').count()
await page.keyboard.press('1'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Space'); await sleep(100); const crash3 = await page.getByTestId('crash').count()
log({ case: 'issue.by null', importToast: t1.slice(0, 80), crashOnOpen: crash1, crashText, crashOnView4AfterReload: crash2, crashOnOpenAfterReload: crash3 })
save2('14-focus-storage.json', out)
dumpErrors(errors, 'focus-storage')
await browser.close()
