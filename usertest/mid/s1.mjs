import { launch, check, log } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')

// ---- 新規BOM（ガイド）→ 貼り付け 30 行
const rows = []
const cats = ['制御', '電源', '操作', 'センサ', '配線']
const parts = [
  ['リレー', 'MY4N-D2 DC24 ', 'オムロン', 4, '個', 'KA1'],         // 前後空白（警告）
  ['ソケット', 'PYF14A-E', 'オムロン', 4, '個', 'KA1S'],
  ['CP', 'CP30-BA 2P', '三菱電機', 2, '個', 'CP1'],                 // CP30 定格なし（警告）
  ['端子台', 'ＰＴ ２，５', 'フエニックス', 40, '個', 'TB1'],         // 全角（警告）
  ['電源', 'S8VK-G12024', '', 1, '個', 'PS1'],                     // メーカ空（エラー）
  ['ブレーカ', 'NF32-SV 3P 30A', '三菱電機', 0, '個', 'MCCB1'],      // 数量0（エラー）
  ['押しボタン', 'A22NN-BPM-NGA', 'オムロン', 3, '個', 'PB1'],
  ['押しボタン', 'A22NN-BPM-NRA', 'オムロン', 3, '個', 'PB1'],        // 回路記号重複（警告）
  ['圧着端子', '1.25Y-3', 'ニチフ', 150, 'パック', 'T1'],            // パック
  ['', 'XYZ-1', 'メーカX', 1, '個', 'N1'],                          // 部品名空（エラー）
]
for (let i = 0; i < 30; i++) {
  const b = parts[i % parts.length]
  const model = i < parts.length ? b[1] : b[1].trim().replace(/[Ａ-Ｚ０-９，]/g, 'X') + '-' + i
  rows.push([cats[i % 5], i < parts.length ? b[0] : b[0] + i, model, i < parts.length ? b[2] : b[2] || 'メーカ', i < parts.length ? b[3] : (i % 4) + 1, b[4], i < parts.length ? b[5] : 'R' + i].join('\t'))
}
await t.press('Control+k')
await page.getByTestId('palette-input').fill('新しいBOM')
await t.press('Enter')
await page.getByTestId('wizard-id').fill('P-2026-101')
await t.press('Enter')
await page.getByTestId('wizard-name').fill('中堅テスト盤')
await t.press('Enter')
await page.getByTestId('wizard-due').fill('2026-12-18')
await t.press('Enter')
await page.getByTestId('wizard-processDays').fill('10')
await t.press('Enter')
await page.getByTestId('wizard-budget').fill('1500000')
await t.press('Enter')
await page.getByTestId('wizard-buyer').fill('佐藤')
await t.press('Enter')
await t.press(' ', 'ArrowDown', ' ', 'ArrowDown', ' ') // S1 S2 S3
await t.press('Enter')
await t.press('1')
await page.getByTestId('wizard-paste').fill(rows.join('\n'))
await t.press('Control+Enter')
await t.press('Enter')
await page.waitForTimeout(200)
log('header:', await t.header())
log('toast:', await t.toast())
check('S1 案件作成 30 行', (await t.rowCount()) > 0)
await t.press('1')
log('rows in view1:', await t.rowCount(), ' view4:', await t.viewCount(4), 'lamps:', await t.lamps())
let p = await t.proj()
log('members', JSON.stringify(p.members), 'supplierIds', p.supplierIds, 'due', p.dueDate, 'pmConfirmed', p.settings.pmConfirmed)
check('S1 パックの入数が貼付時に入らない（packQty null）', p.rows[8].packQty === null, JSON.stringify(p.rows[8].packQty))
await t.shot('s1-01-created')

// ---- 4 要確認で n / Ctrl+. / x / Shift+→
await t.press('4')
await t.press('n')
log('n → cursor:', await t.cursor(), ' status:', await t.status())
// Ctrl+. の候補を見る
await t.press('Control+.')
const qf = await page.getByTestId('quickfix').textContent()
log('quickfix:', qf)
await t.press('Escape')
// 問題一覧（ルール評価）を直接見る
p = await t.proj()
log('problems by lamps:', await t.lamps())
// 全問題を順に処理: エラーは直す、警告は Ctrl+. の候補 or x、回路記号の 1 つは Shift+→
let deferredOnce = false
const seen = {}
for (let i = 0; i < 25; i++) {
  await t.press('n')
  await page.waitForTimeout(60)
  const tt = await t.toast()
  if (/問題はありません/.test(tt)) { log('n: 問題はありません'); break }
  const cur = await t.cursor()
  const id = cur.split(' ')[0]
  const colLabel = cur.split(' ').slice(1).join(' ')
  seen[cur] = (seen[cur] ?? 0) + 1
  const r = await t.row(id)
  log(`problem ${i}:`, cur, '| model=', JSON.stringify(r?.model), '| lamps:', await t.lamps())
  if (seen[cur] > 2) { log('  loop detected, x'); await t.press('x'); continue }
  if (colLabel === 'メーカ') { await t.press('Enter'); await t.type('オムロン'); await t.press('Enter') }
  else if (colLabel === '必要数') { await t.press('Enter'); await t.press('Control+a'); await t.type('1'); await t.press('Enter') }
  else if (colLabel === '部品名') { await t.press('Enter'); await t.type('不明部品'); await t.press('Enter') }
  else if (colLabel === '型式' && /CP30/.test(r?.model ?? '')) { await t.press('Enter'); await t.press('Control+a'); await t.type('CP30-BA 2P 1-M 10A'); await t.press('Enter') }
  else if (colLabel === '型式') { await t.press('Control+.'); const q = await page.getByTestId('quickfix').textContent(); log('  qf:', q.slice(0, 140)); if (/半角に変換|空白を削除/.test(q)) await t.press('1'); else { await t.press('Escape'); await t.press('x') } }
  else if (colLabel === '回路記号' && !deferredOnce) { deferredOnce = true; await t.press('Shift+ArrowRight'); log('  deferred (Shift+→) → cursor now', await t.cursor()) }
  else { await t.press('x'); log('  x →', await t.toast()) }
  await page.waitForTimeout(50)
}
log('lamps after fixes:', await t.lamps(), ' status:', await t.status())
await t.shot('s1-02-after-fixes')
// 公開（あとで が残っていれば不可のはず）
await t.press('Control+Enter')
await page.waitForTimeout(100)
log('publish toast (with deferred):', await t.toast())
const toast1 = await t.toast()
check('S1 「あとで」が残ると公開不可', /あとで/.test(toast1), toast1)
// あとで にした行の問題を直す（回路記号を変える）→ 公開できるか？
p = await t.proj()
const def = p.rows.find((r) => r.deferredRules.length)
log('deferred row:', def?.id, def?.deferredRules)
if (def) {
  await t.setCell(def.id, '回路記号', 'PB2')
  await t.press('Control+Enter')
  await page.waitForTimeout(100)
  const tt = await t.toast()
  log('publish toast after fixing deferred:', tt)
  check('S1 「あとで」の問題を直した後に公開できる', /公開しました/.test(tt), tt)
  if (!/公開しました/.test(tt)) {
    // 回避: Ctrl+. で候補を確認
    await t.goto(def.id); await t.press('Control+.'); log('  quickfix for deferred row:', await page.getByTestId('quickfix').textContent()); await t.press('Escape')
    // 回避2: Ctrl+Z で戻せるか
    await page.evaluate(() => { const ws = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); for (const p of ws.projects) for (const r of p.rows) r.deferredRules = []; localStorage.setItem('bom-pro.workspace.v2', JSON.stringify(ws)) })
    await t.reload()
    await t.press('Control+Enter')
    await page.waitForTimeout(100)
    log('publish toast after manual clear:', await t.toast())
  }
}
p = await t.proj()
log('submissions:', p.submissions.map((s) => `Rev${s.rev} rows=${s.rowIds.length}`), 'caseDecisions:', JSON.stringify(p.caseDecisions))
log('rev-info:', await page.getByTestId('rev-info').textContent().catch(() => 'none'))
check('S1 Rev.1 で案件設定確定が caseDecisions に載る', p.caseDecisions.some((c) => c.kind === '案件設定確定' && c.status === 'open'))
log('statuses:', [...new Set(p.rows.map((r) => r.status))], 'quotes:', p.quotes.length)
log('rows due:', p.rows.slice(0, 3).map((r) => r.dueAt))
// PM の 7 に載るか
await t.role('pm')
await t.press('7')
log('PM view7 count:', await t.viewCount(7), 'rows:', await t.rowCount(), 'status:', await t.status())
check('S1 PM の 7 要決定に「案件設定確定」が載る', Number(await t.viewCount(7)) > 0 && /案件設定/.test(await page.locator('main').textContent()))
log('toolbar text:', await page.locator('.toolbar').textContent())
await t.shot('s1-03-pm-view7')
// PM: 案件設定を確定（パレット）
await t.press('Control+k')
await page.getByTestId('palette-input').fill('案件設定')
await page.waitForTimeout(50)
log('palette items:', (await page.getByTestId('palette-list').textContent()).slice(0, 300))
await t.press('Enter')
await page.waitForTimeout(100)
log('settings panel visible:', await page.getByTestId('settings').count())
await t.press('y')
await page.waitForTimeout(100)
log('after y:', await t.toast(), 'pmConfirmed:', (await t.proj()).settings.pmConfirmed)
check('S1 PM が案件設定を確定できる', (await t.proj()).settings.pmConfirmed === true)

// ---- 購買: 概算見積を依頼
await t.role('purchasing')
await t.press('9')
log('purchasing view9 count:', await t.viewCount(9))
await t.press('Control+k')
await page.getByTestId('palette-input').fill('概算見積')
await t.press('Enter')
await page.waitForTimeout(100)
log('request prompt:', await page.locator('[data-testid="panel-prompt"]').textContent())
// Enter で相見積先すべてに依頼（空のまま）
await t.press('Enter')
await page.waitForTimeout(100)
log('request Enter(empty) toast:', await t.toast())
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 3000 }).catch(() => null), (async () => { await page.getByTestId('prompt-text').fill('2026-10-29'); await t.press('Enter') })()])
await page.waitForTimeout(400)
log('request toast:', await t.toast(), 'download:', dl ? dl.suggestedFilename() : 'none')
p = await t.proj()
log('after request statuses:', [...new Set(p.rows.map((r) => r.status))], 'requestRevs:', JSON.stringify(p.requestRevs), 'deadline:', p.settings.quoteDeadline)
const reqMsg = await t.toast()
check('S1 「Enter で相見積先すべてに依頼」で 3 社に依頼される', /× 3 社/.test(reqMsg), reqMsg)
check('S1 依頼後に見積中になる', p.rows.every((r) => r.status === 'quoting'), [...new Set(p.rows.map((r) => r.status))].join())
await t.shot('s1-04-requested')

// ---- 6 商社別で手入力（Enter/Tab 連続入力）
await t.press('6')
log('view6 cols:', await page.locator('thead th').allTextContents())
await t.goto('R001')
await t.colKey('q.unitPrice@S1')
// Tab 連続: 単価 → 納期 → MOQ → 在庫 → 有効期限
await t.press('Enter'); await t.type('1200'); await t.press('Tab')
log('after Tab mode/cursor:', await page.getByTestId('mode').textContent(), await t.curCol())
await t.type('5') // ナビモードで数字 → ビュー切替になるはず
log('after typing 5 in nav: view5 current?', await page.getByTestId('view-5').getAttribute('aria-current'), 'mode:', await page.getByTestId('mode').textContent())
check('S1 Tab 確定後に数字を打つと（Excel 流儀）セル入力にならずビュー 5 に切り替わる → 使い勝手', (await page.getByTestId('view-5').getAttribute('aria-current')) !== 'true')
await t.press('6'); await t.goto('R001'); await t.colKey('q.leadDays@S1')
await t.press('Enter'); await t.type('5'); await t.press('Tab')
await t.press('Enter'); await t.type('1'); await t.press('Tab')
await t.press('Enter'); await t.type('在'); await t.press('Tab')
await t.press('Enter'); await t.type('2026-11-30'); await t.press('Enter')
log('R001 after input:', await t.cell('R001', 'q.unitPrice@S1'), await t.cell('R001', 'q.leadDays@S1'), await t.cell('R001', 'q.moq@S1'), await t.cell('R001', 'q.stock@S1'), await t.cell('R001', 'q.validUntil@S1'), await t.cell('R001', 'status'))
check('S1 6 で Tab 連続入力できる', (await t.cell('R001', 'q.stock@S1')) === '在庫' && (await t.cell('R001', 'q.leadDays@S1')) === '5日')
// Enter 連続（下へ）
await t.goto('R002'); await t.colKey('q.unitPrice@S1')
await t.press('Enter'); await t.type('300'); await t.press('Enter'); await t.type('400')
log('Enter→数字: view4 current?', await page.getByTestId('view-4').getAttribute('aria-current'))
await t.press('6'); await t.goto('R003'); await t.colKey('q.unitPrice@S1'); await t.press('Enter'); await t.type('400'); await t.press('Enter')
log('Enter 連続:', await t.cell('R002', 'q.unitPrice@S1'), await t.cell('R003', 'q.unitPrice@S1'), 'cursor:', await t.cursor())
// Excel 貼り付け（タブ区切り、複数行×複数列）: R004 から S2 列へ
const tsv = Array.from({ length: 27 }, (_, i) => `${500 + i * 10}\t${3 + (i % 5)}\t${i % 3 === 0 ? 10 : ''}\t取寄\t2026-11-30`).join('\n')
await page.evaluate((s) => navigator.clipboard.writeText(s), tsv)
await t.goto('R004'); await t.colKey('q.unitPrice@S2')
const t0 = Date.now()
await t.press('Control+v')
await page.waitForTimeout(500)
log('paste toast:', await t.toast(), 'ms:', Date.now() - t0)
log('R004 S2:', await t.cell('R004', 'q.unitPrice@S2'), await t.cell('R004', 'q.leadDays@S2'), await t.cell('R004', 'q.moq@S2'), await t.cell('R004', 'q.stock@S2'), ' R030 S2:', await t.cell('R030', 'q.unitPrice@S2'))
check('S1 Excel 貼り付け（27 行 × 5 列）が入る', (await t.cell('R030', 'q.unitPrice@S2')) !== '')
// 全商社ぶんを一括で入れて見積済になるか（S1,S2,S3 すべて）
const all = Array.from({ length: 30 }, (_, i) => [`${1000 + i * 7}\t${2 + (i % 6)}\t\t在庫\t2026-11-30`, `${1100 + i * 5}\t${4 + (i % 7)}\t${i % 4 === 0 ? 20 : ''}\t取寄\t2026-11-30`, `${1050 + i * 9}\t${8 + (i % 9)}\t\t受注生産\t2026-11-30`].join('\t')).join('\n')
await page.evaluate((s) => navigator.clipboard.writeText(s), all)
await t.goto('R001'); await t.colKey('q.unitPrice@S1')
await t.press('Control+v')
await page.waitForTimeout(1500)
log('paste all toast:', await t.toast())
p = await t.proj()
log('statuses after all answered:', p.rows.reduce((m, r) => ({ ...m, [r.status]: (m[r.status] ?? 0) + 1 }), {}), 'quoteCompleteRule:', p.settings.quoteCompleteRule)
check('S1 回答が揃うと見積済になる', p.rows.every((r) => r.status === 'quoted'), JSON.stringify(p.rows.reduce((m, r) => ({ ...m, [r.status]: (m[r.status] ?? 0) + 1 }), {})))
log('R001 flags:', JSON.stringify(p.rows[0].flags), 'quotedAt', p.rows[0].quotedAt, 'ball cell:', await t.cell('R001', 'status'))
log('lamps:', await t.lamps())
await t.shot('s1-05-quoted')
// 見積済の行が設計の 4 に出るか（選定待ち）
await t.role('design')
await t.press('4')
log('design view4 count after quoted:', await t.viewCount(4), 'lamps:', await t.lamps())
check('S1 見積済の行が選定者（設計）の 4 に出る', Number(await t.viewCount(4)) >= 30, await t.viewCount(4))

// ---- 見積回答を取り込む（別商社 S3 を再度）
await t.role('purchasing')
await t.press('Control+k')
await page.getByTestId('palette-input').fill('見積回答')
await t.press('Enter')
await page.waitForTimeout(100)
log('import prompt:', (await page.locator('[data-testid="panel-prompt"]').textContent()).slice(0, 200))
await t.press('3') // S3
await page.waitForTimeout(100)
const imp = ['行ID\t部品名\t型式\tメーカ\tメーカ指定\t代替可否\t必要数\t単位\t必要日\t備考\t単価\t納期\tMOQ\t在庫区分\t見積数量\t代替型式\t代替メーカ\t代替単価\t代替納期\t有効期限',
  'R001\tリレー\tMY4N-D2 DC24\tオムロン\t推奨\t同等品可\t4\t個\t\t\t980\t3\t\t在庫\t4\t\t\t\t\t2026-12-31',
  'R002\tソケット\tPYF14A-E\tオムロン\t推奨\t同等品可\t4\t個\t\t\t250\t即納\t10\t在庫\t10\tPYF14A-N\tオムロン\t230\t2\t2026-12-31',
  'R099\tない\tNONE\t\t\t\t1\t個\t\t\t1\t1\t\t\t\t\t\t\t\t',
  'R003\tCP\tCP30-XX\t三菱電機\t推奨\t同等品可\t2\t個\t\t\t2000\t取扱なし\t\t\t\t\t\t\t\t'].join('\n')
await page.getByTestId('import-text').fill(imp)
await t.press('Control+Enter')
await page.waitForTimeout(200)
log('import toast:', await t.toast())
p = await t.proj()
const q2 = p.quotes.find((q) => q.rowId === 'R002' && q.supplierId === 'S3')
log('R002 S3 quote:', JSON.stringify(q2), 'issues:', p.issues.map((i) => `${i.id} ${i.kind} ${i.status} ${i.rowId}`))
check('S1 取込で代替提案の下書き指摘が生成される', p.issues.some((i) => i.kind === '代替提案' && i.status === 'draft' && i.rowId === 'R002'))
check('S1 取込: 突合不能 R099 / 型式不一致 R003 が報告される', /突合不能 1/.test(await t.toast()) && /型式不一致 1/.test(await t.toast()), await t.toast())
await t.press('4')
log('purchasing view4 after import:', await t.viewCount(4), 'rows:', await t.rowCount())
await t.shot('s1-06-import')
log('ERRORS:', t.errors)
await t.close()
