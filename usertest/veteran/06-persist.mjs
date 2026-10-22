import { launch, fresh, setRole, goto, toCol, cursor, mode, toast, dumpErrors, shot, save, state, sleep, DL } from './lib.mjs'
import fs from 'node:fs'
import path from 'node:path'
const { browser, context, page, errors } = await launch()
const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 400)) }
await fresh(page)
// ---- 2 tabs same localStorage
const pageB = await context.newPage(); pageB._tag = 'tabB'
await pageB.goto('http://localhost:5173/'); await pageB.waitForSelector('[data-testid="grid"]'); await pageB.locator('.gridwrap').focus()
// A edits R020 name
await goto(page, 'R020'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('A編集'); await page.keyboard.press('Enter'); await sleep(50)
const nameInA = (await state(page)).projects[0].rows.find((r) => r.id === 'R020')
log({ case: 'A edited R020', working: nameInA.working })
// B: without reload, does it see? then B edits R021
const bSees = await pageB.locator('[data-row-id="R020"] td.name').textContent()
log({ case: 'B sees A edit without reload?', bSees })
await goto(pageB, 'R021'); await pageB.keyboard.press('Enter'); await pageB.keyboard.press('Control+a'); await pageB.keyboard.type('B編集'); await pageB.keyboard.press('Enter'); await sleep(50)
const ls = await state(pageB)
log({ case: 'after B edit: localStorage', r020: ls.projects[0].rows.find((r) => r.id === 'R020').working, r021: ls.projects[0].rows.find((r) => r.id === 'R021').working })
await page.reload(); await page.waitForSelector('[data-testid="grid"]')
log({ case: 'A after reload', r020: await page.locator('[data-row-id="R020"] td.name').textContent(), r021: await page.locator('[data-row-id="R021"] td.name').textContent() })
await shot(page, '06-tabA-after-reload')
await pageB.close()
// ---- reload keeps state but undo stack?
await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+z'); log({ case: 'Ctrl+Z after reload', toast: await toast(page) })
// ---- browser back / forward
await page.goto('http://localhost:5173/?x=1'); await page.waitForSelector('[data-testid="grid"]')
await page.goBack(); await sleep(200); log({ case: 'goBack', url: page.url(), grid: await page.getByTestId('grid').count() })
await page.goForward(); await sleep(200); log({ case: 'goForward', url: page.url(), grid: await page.getByTestId('grid').count() })
await page.goBack(); await page.waitForSelector('[data-testid="grid"]')
// ---- JSON export → import roundtrip
await page.locator('.gridwrap').focus()
const before = await state(page)
const dlp = page.waitForEvent('download')
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('JSON を書き出す'); await page.keyboard.press('Enter')
const dl = await dlp; const fp = path.join(DL, dl.suggestedFilename()); await dl.saveAs(fp)
const text = fs.readFileSync(fp, 'utf8')
log({ case: 'json export', file: dl.suggestedFilename(), bytes: text.length, same: JSON.stringify(JSON.parse(text)) === JSON.stringify(before) })
// import into fresh
await fresh(page)
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('JSON を読み込む'); await page.keyboard.press('Enter')
await page.getByTestId('import-text').fill(text); await page.keyboard.press('Control+Enter'); await sleep(200)
const after = await state(page)
const diff = []
const cmp = (a, b, p) => { if (JSON.stringify(a) !== JSON.stringify(b)) diff.push(p) }
cmp(after.projects, before.projects, 'projects'); cmp(after.suppliers, before.suppliers, 'suppliers'); cmp(after.rules, before.rules, 'rules'); cmp(after.user, before.user, 'user'); cmp(after.currentProjectId, before.currentProjectId, 'currentProjectId')
log({ case: 'json import roundtrip', toast: await toast(page), diff, r020: await page.locator('[data-row-id="R020"] td.name').textContent() })
// import garbage
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('JSON を読み込む'); await page.keyboard.press('Enter')
await page.getByTestId('import-text').fill('{"projects": "x"}'); await page.keyboard.press('Control+Enter'); await sleep(200)
log({ case: 'json import garbage {"projects":"x"}', toast: await toast(page), grid: await page.getByTestId('row').count().catch((e) => 'ERR ' + e.message), errs: errors.filter((e) => e.type === 'pageerror').map((e) => e.text) })
await shot(page, '06-after-garbage-import')
// import partial: projects array of empty object
await page.reload().catch(() => {}); await page.waitForSelector('[data-testid="grid"]', { timeout: 5000 }).catch(() => {})
log({ case: 'after reload post-garbage', grid: await page.getByTestId('grid').count(), rows: await page.getByTestId('row').count(), errs: errors.filter((e) => e.type === 'pageerror').length })
await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus()
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('JSON を読み込む'); await page.keyboard.press('Enter')
await page.getByTestId('import-text').fill('{"projects":[{"id":"X"}],"user":{"name":"a","role":"design"},"suppliers":[],"rules":[],"currentProjectId":"X"}'); await page.keyboard.press('Control+Enter'); await sleep(300)
log({ case: 'json import minimal project', toast: await toast(page), grid: await page.getByTestId('grid').count(), errs: errors.filter((e) => e.type === 'pageerror').map((e) => e.text.slice(0, 120)) })
await shot(page, '06-minimal-import')
// localStorage quota: huge note
await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus()
await page.evaluate(() => { try { localStorage.setItem('bom-pro.filler', 'x'.repeat(4.5 * 1024 * 1024)) } catch (e) { console.log('filler fail') } })
await goto(page, 'R020'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('quota'); await page.keyboard.press('Enter'); await sleep(50)
const stored = await state(page)
log({ case: 'edit when localStorage near quota', toast: await toast(page), shown: await page.locator('[data-row-id="R020"] td.name').textContent(), stored: stored?.projects?.[0]?.rows.find((r) => r.id === 'R020')?.working ?? 'NOT SAVED' })
await page.reload(); await page.waitForSelector('[data-testid="grid"]')
log({ case: 'after reload near quota', shown: await page.locator('[data-row-id="R020"] td.name').textContent() })
save('06-persist.json', out)
dumpErrors(errors, 'persist')
await browser.close()
