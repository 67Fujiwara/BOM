import { launch, check, log } from './lib.mjs'
import fs from 'node:fs'
const t = await launch()
const { page } = t
await t.open('purchasing')
// 発注: 見積済の行に o → 不可
await t.goto('R020'); await t.press('o'); await page.waitForTimeout(50); log('o on quoted →', await t.toast(), (await t.row('R020')).status)
check('S7 正式見積済でないと発注できない', !(await t.row('R020')).ordered)
// i 入荷 → 発注済も自動オン（ゲートを回避できる？）
await t.goto('R021'); await t.press('i'); await page.waitForTimeout(50); log('i on quoted →', await t.toast(), (await t.row('R021')).status, (await t.row('R021')).ordered, (await t.row('R021')).received)
check('S7 見積済の行に i を押しても入荷済にならない', (await t.row('R021')).status !== 'received', (await t.row('R021')).status)
// 正式見積済 R013 に o
await t.goto('R013'); await t.press('o'); await page.waitForTimeout(50); log('o on formalQuoted →', await t.toast(), (await t.row('R013')).status)
check('S7 正式見積済の行は発注できる', (await t.row('R013')).status === 'ordered')
await t.press('3'); log('view3 count:', await t.viewCount(3), 'cols:', (await page.locator('thead th').allTextContents()).join('|'))
await t.goto('R013'); await t.press('i'); await page.waitForTimeout(50); log('i →', (await t.row('R013')).status, 'ball:', await t.cell('R013', 'ball').catch(() => '-'))
// 発注済の行の設計列ロック
await t.role('design'); await t.goto('R013'); await t.col('型式'); await t.press('Enter'); await page.waitForTimeout(50); log('design edit ordered row →', await t.toast(), await page.getByTestId('mode').textContent()); await t.press('Escape')
await t.press('Shift+Delete'); await page.waitForTimeout(50); log('Shift+Delete on ordered →', await t.toast())
// 先行発注許可後は発注可: 購買が申請 → PM y → 購買 o
await t.role('purchasing'); await t.goto('R022'); await t.press('Control+k'); await page.getByTestId('palette-input').fill('先行発注'); await t.press('Enter'); await page.waitForTimeout(50); await page.getByTestId('prompt-text').fill('LTB'); await t.press('Enter'); await page.waitForTimeout(50)
log('ltb request →', await t.toast(), JSON.stringify((await t.row('R022')).flags))
await t.role('pm'); await t.press('7'); const v7 = await page.locator('[data-row-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-row-id'))); log('7:', v7.join(','))
await t.goto('R022'); await t.press('Enter'); log('panel:', await page.getByTestId('quickfix').textContent()); await t.press('y'); await page.waitForTimeout(50); await t.press('Enter'); await page.waitForTimeout(50)
log('y →', await t.toast(), (await t.row('R022')).status, 'adopted=', (await t.row('R022')).adoptedSupplierId, JSON.stringify((await t.row('R022')).flags))
check('S7 自動/申請の先行発注許可で推奨商社で選定済＋先行', (await t.row('R022')).status === 'selected' && !!(await t.row('R022')).adoptedSupplierId, `${(await t.row('R022')).status} adopted=${(await t.row('R022')).adoptedSupplierId}`)
await t.role('purchasing'); await t.press('1'); await t.goto('R022'); await t.press('o'); await page.waitForTimeout(50); log('o after LTB →', await t.toast(), (await t.row('R022')).status, 'amount:', await t.cell('R022', 'amount').catch(() => '-'))
check('S7 先行発注許可後は発注できる', (await t.row('R022')).status === 'ordered')
// ---- Excel 出力 3 種
const dls = []
page.on('download', (d) => dls.push(d))
for (const k of ['1', '2', '3']) { await t.press('Control+e'); await page.waitForTimeout(50); if (k === '1') log('export panel:', await page.getByTestId('quickfix').textContent()); await t.press(k); await page.waitForTimeout(1200) }
log('downloads:', dls.map((d) => d.suggestedFilename()))
check('S7 Ctrl+E 3 種のダウンロードが発生', dls.length === 3, dls.map((d) => d.suggestedFilename()).join(','))
if (dls[2]) { const path = 'usertest/mid/shots/archive.xlsx'; await dls[2].saveAs(path); log('archive size:', fs.statSync(path).size) }
// 書式つきコピー
await t.press('Control+Shift+c'); await page.waitForTimeout(300); log('copy →', await t.toast())
const clip = await page.evaluate(() => navigator.clipboard.readText()); log('clipboard head:', clip.split('\n').slice(0, 2).join(' | ').slice(0, 200))
check('S7 書式つきコピーで TSV がクリップボードに入る', /ID\t/.test(clip))
// JSON 書き出し / 読み込み往復
await t.press('Control+k'); await page.getByTestId('palette-input').fill('JSON を書き出す'); await t.press('Enter'); await page.waitForTimeout(800)
const jd = dls.at(-1); log('json download:', jd?.suggestedFilename())
let json = ''
if (jd && /json/.test(jd.suggestedFilename())) { const jp = 'usertest/mid/shots/ws.json'; await jd.saveAs(jp); json = fs.readFileSync(jp, 'utf8'); log('json size:', json.length) }
const before = JSON.stringify(await t.ws())
// サンプルに戻してから読み込む
await t.press('Control+k'); await page.getByTestId('palette-input').fill('サンプルデータに戻す'); await t.press('Enter'); await page.waitForTimeout(50); await t.press('1'); await page.waitForTimeout(100)
log('after reset R022:', (await t.row('R022')).status)
await t.press('Control+k'); await page.getByTestId('palette-input').fill('JSON を読み込む'); await t.press('Enter'); await page.waitForTimeout(50)
await page.getByTestId('import-text').waitFor({ timeout: 3000 }).catch(() => log('import panel not open!')); await page.getByTestId('import-text').fill(json, { timeout: 5000 }).catch((e) => log('fill failed', e.message.slice(0, 80))); await t.press('Control+Enter'); await page.waitForTimeout(200)
log('import →', await t.toast(), 'R022:', (await t.row('R022')).status)
const after = JSON.stringify(await t.ws())
check('S7 JSON 往復で R022 の発注済が戻る', (await t.row('R022')).status === 'ordered')
check('S7 JSON 往復でワークスペースが同一', before === after, `len ${before.length} vs ${after.length}`)
// リロード保持
await t.reload(); log('after reload R022:', (await t.row('R022')).status, 'role:', await page.locator('.role button[aria-pressed=true]').textContent())
check('S7 リロード後も保持', (await t.row('R022')).status === 'ordered')
// ---- Undo が自分の操作だけか
await t.role('design'); await t.setCell('R030', '備考', '設計メモ'); log('design note:', (await t.row('R030')).working)
await t.role('purchasing'); await t.press('Control+z'); await page.waitForTimeout(50); log('purchasing Ctrl+Z →', await t.toast(), 'R030 working:', JSON.stringify((await t.row('R030')).working))
check('S7 購買の Ctrl+Z で設計の編集は戻らない', !!(await t.row('R030')).working)
await t.showCol('orderQty'); await t.setCellKey('R030', 'orderQty', '9'); await t.press('Control+z'); await page.waitForTimeout(50); log('purchasing undo own →', await t.toast(), (await t.row('R030')).orderQty)
await t.press('Control+Shift+z'); await page.waitForTimeout(50); log('redo →', await t.toast(), (await t.row('R030')).orderQty)
// 公開済の値への Ctrl+Z は Rev を消さず逆向きの作業中変更として積む
await t.role('design'); await t.press('Control+Enter'); await page.waitForTimeout(100); let d = await page.locator('[role=dialog]').textContent().catch(() => ''); if (/変更セット/.test(d)) { await t.press('6'); await page.waitForTimeout(80) } d = await page.locator('[role=dialog]').textContent().catch(() => ''); if (/Rev/.test(d)) await t.press('1'); await page.waitForTimeout(100)
const revs1 = (await t.proj()).submissions.map((s) => s.rev); log('publish →', await t.toast(), 'revs:', revs1)
await t.press('Control+z'); await page.waitForTimeout(50)
const pr = await t.proj(); log('design Ctrl+Z after publish →', await t.toast(), 'revs:', pr.submissions.map((s) => s.rev), 'R030 note:', pr.rows.find((r) => r.id === 'R030').note, 'working:', JSON.stringify(pr.rows.find((r) => r.id === 'R030').working))
check('S7 公開済の値への Ctrl+Z は Rev を消さず作業中として積む', pr.submissions.length === revs1.length && !!pr.rows.find((r) => r.id === 'R030').working, `revs ${pr.submissions.map((s) => s.rev)} working=${JSON.stringify(pr.rows.find((r) => r.id === 'R030').working)}`)
// 新規案件で PM 名が空 → PM に切り替えると前の人の名前を引き継ぐ？
await t.press('Control+k'); await page.getByTestId('palette-input').fill('新しいBOM'); await t.press('Enter'); await page.getByTestId('wizard-id').fill('P-2'); await t.press('Enter'); await page.getByTestId('wizard-name').fill('案件2'); await t.press('Enter'); await page.getByTestId('wizard-due').fill('2026/12/20'); await t.press('Enter'); await t.press('Enter'); await t.press('Enter'); await page.getByTestId('wizard-buyer').fill('田中'); await t.press('Enter'); await t.press(' '); await t.press('Enter'); await t.press('1'); await page.getByTestId('wizard-paste').fill('制御\tリレー\tMY4N\tオムロン\t1\t個\tKA1'); await t.press('Control+Enter'); await t.press('Enter'); await page.waitForTimeout(150)
log('new project header:', await t.header(), 'due:', (await t.proj()).dueDate, 'needDate cell:', await t.cell('R001', 'needDate').catch(() => '-'))
check('S7 納期 2026/12/20（スラッシュ）を入れると必要日が NaN にならない', !/NaN/.test(await t.header()) && !/NaN/.test(await t.cell('R001', 'needDate').catch(() => '')), await t.header())
await t.role('purchasing'); log('purchasing name:', await page.locator('.header .muted').last().textContent())
await t.role('pm'); const pmName = await page.locator('.header').textContent(); log('pm header:', pmName)
check('S7 PM 未設定の案件で PM に切り替えても購買の名前を引き継がない', !/田中/.test(pmName), pmName.slice(-40))
log('ERRORS:', t.errors)
await t.close()
