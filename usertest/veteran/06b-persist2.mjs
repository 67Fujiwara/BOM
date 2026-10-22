import { launch, fresh, setRole, goto, toCol, cursor, mode, toast, dumpErrors, shot, save, state, sleep, DL } from './lib.mjs'
import fs from 'node:fs'
import path from 'node:path'
const { browser, context, page, errors } = await launch()
const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 400)) }
const pasteInto = async (testid, text) => page.evaluate(([id, t]) => { const el = document.querySelector(`[data-testid="${id}"]`); const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; setter.call(el, t); el.dispatchEvent(new Event('input', { bubbles: true })) }, [testid, text])
await fresh(page)
await goto(page, 'R020'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('編集済'); await page.keyboard.press('Enter')
const before = await state(page)
const dlp = page.waitForEvent('download')
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('JSON を書き出す'); await page.keyboard.press('Enter')
const dl = await dlp; const fp = path.join(DL, dl.suggestedFilename()); await dl.saveAs(fp)
const text = fs.readFileSync(fp, 'utf8')
log({ case: 'json export', file: dl.suggestedFilename(), bytes: text.length, same: JSON.stringify(JSON.parse(text)) === JSON.stringify(before) })
await fresh(page)
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('JSON を読み込む'); await page.keyboard.press('Enter'); await sleep(50)
let t0 = Date.now(); await pasteInto('import-text', text); const pasteMs = Date.now() - t0
await page.keyboard.press('Control+Enter'); await sleep(300)
const after = await state(page)
const diff = []
for (const k of ['projects', 'suppliers', 'rules', 'user', 'currentProjectId']) if (JSON.stringify(after?.[k]) !== JSON.stringify(before[k])) diff.push(k)
log({ case: 'json import roundtrip', pasteMs, toast: await toast(page), diff, r020: await page.locator('[data-row-id="R020"] td.name').textContent() })
// undo after import?
await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+z'); log({ case: 'Ctrl+Z after JSON import', toast: await toast(page) })
// garbage
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('JSON を読み込む'); await page.keyboard.press('Enter'); await sleep(50)
await pasteInto('import-text', '{"projects": "x"}'); await page.keyboard.press('Control+Enter'); await sleep(300)
log({ case: 'json import {"projects":"x"}', toast: await toast(page), grid: await page.getByTestId('grid').count(), rows: await page.getByTestId('row').count(), pageerrors: errors.filter((e) => e.type === 'pageerror').map((e) => e.text.slice(0, 150)) })
await shot(page, '06-after-garbage-import')
await page.reload().catch(() => {}); await page.waitForSelector('[data-testid="grid"]', { timeout: 5000 }).catch(() => {})
log({ case: 'after reload post-garbage', grid: await page.getByTestId('grid').count(), rows: await page.getByTestId('row').count(), pageerrors: errors.filter((e) => e.type === 'pageerror').length, ls: (await state(page)) ? 'has ws' : 'null' })
await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus()
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('JSON を読み込む'); await page.keyboard.press('Enter'); await sleep(50)
await pasteInto('import-text', '{"projects":[{"id":"X","name":"x"}],"user":{"name":"a","role":"design"},"suppliers":[],"rules":[],"currentProjectId":"X"}'); await page.keyboard.press('Control+Enter'); await sleep(300)
log({ case: 'json import minimal project', toast: await toast(page), grid: await page.getByTestId('grid').count(), pageerrors: errors.filter((e) => e.type === 'pageerror').map((e) => e.text.slice(0, 120)) })
await shot(page, '06-minimal-import')
await page.reload().catch(() => {}); await page.waitForSelector('[data-testid="grid"]', { timeout: 5000 }).catch(() => {})
log({ case: 'reload after minimal import', grid: await page.getByTestId('grid').count(), pageerrors: errors.filter((e) => e.type === 'pageerror').length })
// recover? localStorage now holds broken ws → app dead until user clears storage manually
await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus()
// localStorage near quota
await page.evaluate(() => { try { localStorage.setItem('bom-pro.filler', 'x'.repeat(4.6 * 1024 * 1024)) } catch (e) { console.log('filler fail', e.message) } })
await goto(page, 'R020'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('quota'); await page.keyboard.press('Enter'); await sleep(50)
const stored = await state(page)
log({ case: 'edit when localStorage near quota', toast: await toast(page), shown: await page.locator('[data-row-id="R020"] td.name').textContent(), stored: stored?.projects?.[0]?.rows.find((r) => r.id === 'R020')?.working ?? 'NOT SAVED' })
await page.reload(); await page.waitForSelector('[data-testid="grid"]')
log({ case: 'after reload near quota', shown: await page.locator('[data-row-id="R020"] td.name').textContent() })
save('06b-persist2.json', out)
dumpErrors(errors, 'persist2')
await browser.close()
