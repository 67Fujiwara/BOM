// v1: 新規BOM（ガイド）→ 問題の修正・あとで → 公開 → PM の案件設定確定 → 購買の概算見積・6 商社別入力 → 見積済 → 設計の 4
// 再検証: M-02, M-15, U-06, M-23, M-11(a), U-04, U-01, U-02, U-05, M-30, M-36, M-31
import { launch, check, log, summary } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')

const rows = [
  ['制御', 'リレー', 'MY4N-D2 DC24', 'オムロン', 4, '個', 'KA1'],
  ['制御', 'ソケット', 'PYF14A-E', 'オムロン', 4, '個', 'KA2'],
  ['電源', 'CP', 'CP30-BA 2P 1-M 5A', '三菱電機', 2, '個', 'CP1'],
  ['電源', '電源', 'S8VK-G12024', 'オムロン', 1, '個', 'PS1'],
  ['操作', '押しボタン緑', 'A22NN-BPM-NGA', 'オムロン', 3, '個', 'PB1'],
  ['操作', '押しボタン赤', 'A22NN-BPM-NRA', 'オムロン', 3, '個', 'PB1'], // 回路記号重複（警告）
  ['配線', '圧着端子', '1.25Y-3', 'ニチフ', 3, 'パック', 'T1'],
  ['配線', '電線', 'KIV 1.25 黒', '住友電装', 150, 'm', 'W1'],
]
const paste = ['分類\t部品名\t型式\tメーカ\t数量\t単位\t回路記号', ...rows.map((r) => [r[0], r[1], r[2], r[3], r[4], r[5], r[6]].join('\t'))].join('\n')
await t.press('Control+k'); await page.getByTestId('palette-input').fill('新しいBOM'); await t.press('Enter')
await page.getByTestId('wizard-id').fill('P-2026-301'); await t.press('Enter')
await page.getByTestId('wizard-name').fill('中堅R3盤'); await t.press('Enter')
await page.getByTestId('wizard-due').fill('2026-12-25'); await t.press('Enter')
await page.getByTestId('wizard-processDays').fill('10'); await t.press('Enter')
await page.getByTestId('wizard-budget').fill('500000'); await t.press('Enter')
const buyerLabel = await page.getByTestId('wizard').textContent()
log('wizard step6 text:', buyerLabel.slice(0, 200))
check('U-06 ガイドで PM 担当者を聞く', /PM/.test(buyerLabel), buyerLabel.slice(0, 120))
await page.getByTestId('wizard-buyer').fill('佐藤, 鈴木'); await t.press('Enter')
await t.press(' ', 'ArrowDown', ' ', 'ArrowDown', ' '); await t.press('Enter')
await t.press('1'); await page.getByTestId('wizard-paste').fill(paste); await t.press('Control+Enter'); await t.press('Enter'); await page.waitForTimeout(300)
log('created toast:', await t.toast())
let p = await t.proj()
log('members', JSON.stringify(p.members), 'rows', p.rows.length, 'R007', JSON.stringify({ unit: p.rows[6].unit, pack: p.rows[6].packQty }))
check('M-15 新規案件の PM 担当者がガイドの入力どおり', p.members.pm === '鈴木', JSON.stringify(p.members))

// M-02: 回路記号重複に「あとで」→ 解除できるか
await t.press('4')
log('view4 rows design:', (await t.viewRows()).join(','))
await t.goto('R006'); await t.colKey('ref'); await t.press('Shift+ArrowRight'); log('defer →', await t.toast())
await t.press('Control+Enter'); await page.waitForTimeout(80); log('publish with defer →', await t.toast())
check('M-02a 「あとで」が残っていると公開できない（ゲート）', /あとで/.test(await t.toast()))
// x で確認済みにすると「あとで」が外れる
await t.goto('R006'); await t.colKey('ref'); await t.press('x'); log('x →', await t.toast())
await t.press('Control+Enter'); await page.waitForTimeout(100)
let d = await t.panel(); log('publish dialog:', JSON.stringify(d))
if (d?.kind === 'prompt') { await t.press('Enter'); await page.waitForTimeout(80) }
log('publish →', await t.toast())
p = await t.proj()
check('M-02 x で確認済みにすると「あとで」が外れて公開できる', p.submissions.length === 1 && p.rows.every((r) => r.status === 'submitted'), p.rows.map((r) => r.status).join(','))
// 2回目: あとで→直す でも公開できるか（R005 の型式を作業中に変え、R006 回路記号を defer → 直す）
await t.press('1'); log(await t.setCellKey('R006', 'ref', 'PB1'))
await t.goto('R006'); await t.colKey('ref'); await t.press('x') // 確認済みを外す（トグル）
log('x toggle →', await t.toast())
await t.goto('R006'); await t.colKey('ref'); await t.press('Shift+ArrowRight'); log('defer2 →', await t.toast())
log(await t.setCellKey('R006', 'ref', 'PB2'))
await t.press('Control+Enter'); await page.waitForTimeout(100); d = await t.panel(); log('publish2 dialog:', JSON.stringify(d)?.slice(0, 200))
if (d?.kind === 'prompt') { await t.press('6'); await page.waitForTimeout(40); await t.press('Enter'); await page.waitForTimeout(80) }
log('publish2 →', await t.toast())
p = await t.proj(); check('M-02b 「あとで」の問題を直せば公開できる', p.submissions.length >= 2, `subs=${p.submissions.length}`)
check('U-02 変更理由で数字キー（6 その他）が選べる', p.submissions.at(-1)?.changeSet?.reason === 'その他', JSON.stringify(p.submissions.at(-1)?.changeSet))

// M-23: PM の 7 に案件設定確定
await t.role('pm')
const pmName = (await t.ws()).user.name
log('PM user name:', pmName, 'view', await t.view())
const items7 = await t.viewItems(); log('PM 7 items:', items7.join(','))
check('M-15b PM に切り替えると PM 担当の氏名', pmName === '鈴木', pmName)
check('M-23 7 に「案件設定確定」が載り件数にも入る', items7.some((k) => k.startsWith('case:')) && (await t.viewCount(7)) >= 1, `count=${await t.viewCount(7)}`)
log('status bar:', (await t.status()).slice(0, 120))
// Undo across roles: PM の Ctrl+Z で設計の操作が戻らない
await t.press('Control+z'); log('PM Ctrl+Z →', await t.toast())
check('M-15c PM の Ctrl+Z は設計の操作を戻さない', /戻す操作がありません/.test(await t.toast()), await t.toast())
// y で確定
await t.press('Control+ArrowUp'); log('cur', await t.curRow()); await t.press('y'); await page.waitForTimeout(60)
p = await t.proj(); log('pmConfirmed', p.settings.pmConfirmed, p.caseDecisions)
check('M-23b y で案件設定確定', p.settings.pmConfirmed === true)

// 購買: 概算見積を依頼 → 6 商社別で入力（U-01）
await t.role('purchasing')
await t.cmd('概算見積を依頼'); await page.waitForTimeout(60); await t.press('Enter'); await page.waitForTimeout(800)
log('request →', await t.toast())
await t.press('6')
const cols6 = await t.S('return null')
// R001: 因幡 単価 Enter → 数字 → Tab → 数字（U-01）
await t.goto('R001'); await t.colKey('q.unitPrice@S1'); await t.press('Enter'); await t.type('1200'); await t.press('Tab'); await t.type('5'); await page.waitForTimeout(80)
log('after typing 5 → view', await t.view(), 'mode', await t.mode(), 'col', await t.curCol())
await t.press('Enter'); await page.waitForTimeout(40)
let qs = await t.quotes('R001'); log('R001 S1', JSON.stringify(qs.find((q) => q.supplierId === 'S1')))
check('U-01 6 商社別で Tab 確定後に数字を続けて打てる', (await t.view()) === 6 && qs.find((q) => q.supplierId === 'S1')?.leadDays === 5)
// 残りは貼り付けで（行×[S1単価,納期,MOQ,在庫,有効期限,S2…,S3…]）
const prices = {
  R001: [[1200, 5, null, '取寄'], [1150, 12, null, '取寄'], [1300, 0, null, '在庫']],
  R002: [[300, 5, null, '取寄'], [280, 5, 10, '取寄'], [320, 3, null, '取寄']],
  R003: [[5000, 10, null, '取寄'], [5200, 10, null, '取寄'], [4800, 30, null, '受注生産']],
  R004: [[8000, 7, null, '取寄'], [7900, 7, null, '取寄'], [8100, 7, null, '取寄']],
  R005: [[900, 7, null, '取寄'], [880, 7, null, '取寄'], [950, 7, null, '取寄']],
  R006: [[900, 7, null, '取寄'], [990, 7, null, '取寄'], [950, 7, null, '取寄']],
  R007: [[3263, 3, 10, '在庫'], [3000, 3, null, '取寄'], [3400, 3, null, '取寄']],
  R008: [[20, 3, 200, '取寄'], [22, 3, 100, '取寄'], [18, 3, 500, '取寄']],
}
const valid = '2026-12-31'
const lines = Object.values(prices).map((sups) => sups.map(([pr, ld, moq, st]) => [pr, ld, moq ?? '', st, valid].join('\t')).join('\t')).join('\n')
await page.evaluate((txt) => navigator.clipboard.writeText(txt), lines)
await t.goto('R001'); await t.colKey('q.unitPrice@S1'); await t.press('Control+v'); await page.waitForTimeout(300)
log('paste →', await t.toast())
p = await t.proj()
log('statuses after quotes:', p.rows.map((r) => r.id + ':' + r.status).join(' '))
await t.shot('v1-view6')

// 設計の 4 と ヘッダー
await t.role('design')
const v4 = await t.viewRows(); log('design view4:', v4.join(','), 'lamps', await t.lamps())
check('M-11a 見積済（選定待ち）の行が設計の 4 に出る', p.rows.filter((r) => r.status === 'quoted').every((r) => v4.includes(r.id)), v4.join(','))
check('U-04 ヘッダー「設計待ち」に内訳', /設計待ち\s*\d+（/.test(await t.lamps()), await t.lamps())

// スコア: R007 パック単位（M-03）, R008 MOQ（M-36 余剰金額）
await t.press('1'); await t.goto('R007'); await t.press(' '); await page.waitForTimeout(60)
const det7 = await page.getByTestId('detail').textContent(); log('R007 detail:', det7.slice(0, 400))
await t.press(' ')
await t.goto('R008'); await t.press(' '); await page.waitForTimeout(60)
const det8 = await page.getByTestId('detail').textContent(); log('R008 detail:', det8.slice(0, 400))
check('M-36 スコア内訳に余剰金額', /¥\d/.test(det8.split('丸め')[1] ?? ''), det8.slice(0, 200))
await t.press(' ')
// 手計算: R008 (150m) S1 ¥20 MOQ200, S2 ¥22 MOQ100 → 丸め 200/150, S3 ¥18 MOQ500
const sc8 = await t.S(`return null`)
// M-03 パック行の採用 → 発注数
await t.goto('R007'); await t.press('a'); await page.waitForTimeout(60); log('a R007 →', await t.toast())
const r7 = await t.row('R007'); log('R007', r7.adoptedSupplierId, 'orderQty', r7.orderQty, 'amount', await t.cellText('R007', 'amount'))
check('M-03 パック単位の行は入数で丸めない（発注数 3 パック）', r7.orderQty === 3 || (r7.orderQty === 10 && r7.adoptedSupplierId === 'S1'), JSON.stringify({ oq: r7.orderQty, s: r7.adoptedSupplierId }))
// M-04: 採用前後でスコアが変わらない（R008: MOQ のある商社）
const before8 = await t.S(`return null`)
await t.goto('R008'); await t.press(' '); const b8 = await page.getByTestId('detail').textContent(); await t.press(' ')
await t.goto('R008'); await t.press('Shift+A'); await page.waitForTimeout(60); log('adopt panel:', JSON.stringify(await t.panel()))
await t.press('3'); await page.waitForTimeout(60); log('reason prompt:', JSON.stringify(await t.panel())?.slice(0, 200))
await t.press('1'); await page.waitForTimeout(40); const pnl = await t.panel(); log('after 1 in reason:', JSON.stringify(pnl)?.slice(0, 200))
await t.press('Enter'); await page.waitForTimeout(80); log('Shift+A 3 →', await t.toast())
await t.goto('R008'); await t.press(' '); const a8 = await page.getByTestId('detail').textContent(); await t.press(' ')
const sc = (s) => (s.match(/\d\. [^¥]+¥[\d,]+.*?(?=\d\. |指摘)/g) ?? []).map((x) => x.slice(0, 60))
log('R008 before:', sc(b8)); log('R008 after:', sc(a8))
check('M-04 採用してもスコアが変わらない', JSON.stringify(sc(b8).map((x) => x.replace(/^\d\. /, '')).sort()) === JSON.stringify(sc(a8).map((x) => x.replace(/^\d\. /, '')).sort()))
const r8 = await t.row('R008'); log('R008', JSON.stringify({ a: r8.adoptedSupplierId, oq: r8.orderQty, reason: r8.adoptReason, f: r8.flags }))

// U-05: リロード後の Undo
await t.reload(); await t.press('Control+z'); await page.waitForTimeout(60); log('Ctrl+Z after reload →', await t.toast())
check('U-05 リロード後も Ctrl+Z が効く', /元に戻す/.test(await t.toast()), await t.toast())
await t.press('Control+y'); log('redo →', await t.toast())

// M-31: 最小ロットのテンプレ（選定前の行 R002 S2 MOQ10）
await t.role('purchasing'); await t.press('1'); await t.goto('R002'); await t.press('Shift+I'); await t.press('l'); await page.waitForTimeout(40); await t.press('Enter'); await page.waitForTimeout(60)
p = await t.proj(); const ml = p.issues.find((i) => i.rowId === 'R002' && i.kind === '最小ロット'); log('最小ロット text:', ml?.text)
check('M-31 最小ロットの本文が MOQ で丸め数量・余剰金額を出す', /丸め数量 10/.test(ml?.text ?? '') && /¥/.test(ml?.text ?? ''), ml?.text)

summary(); await t.close()
