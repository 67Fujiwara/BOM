// v1b: M-02（あとで）・U-05（リロード後の Undo）・M-30（Alt+A 見積中）・U-02（変更理由の数字）
import { launch, check, log, summary } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
// サンプルの下書き R076〜R080 を使う。R077 の回路記号を R076 と同じにして重複（警告）を作る
await t.press('1')
const r76 = await t.row('R076'); log('R076 ref', r76.ref, 'R077 ref', (await t.row('R077')).ref)
log(await t.setCellKey('R077', 'ref', r76.ref))
const probs = await t.S(`return Object.fromEntries([...(${'null'} ?? [])])`).catch(() => null)
// 両方を「あとで」
for (const id of ['R076', 'R077']) { await t.goto(id); await t.colKey('ref'); await t.press('Shift+ArrowRight'); log('defer', id, '→', await t.toast()) }
let ws = await t.proj(); log('deferred', ws.rows.filter((r) => r.deferredRules.length).map((r) => r.id + ':' + r.deferredRules))
await t.press('Control+Enter'); await page.waitForTimeout(80); log('publish →', await t.toast())
check('M-02a 「あとで」が残る間は公開不可', /あとで/.test(await t.toast()))
// 直す: R077 の回路記号を変える → 両行の重複が消える → 公開できる
log(await t.setCellKey('R077', 'ref', 'ZZ77'))
await t.press('Control+Enter'); await page.waitForTimeout(100)
let d = await t.panel(); log('dialog', JSON.stringify(d)?.slice(0, 220))
// 変更セット（提出後の追加）→ 理由を数字で
if (d?.kind === 'prompt') { await t.press('2'); await page.waitForTimeout(50); log('after 2:', JSON.stringify(await t.panel())?.slice(0, 120)); if (await t.panel()) { await t.press('Enter'); await page.waitForTimeout(80) } }
log('publish2 →', await t.toast())
ws = await t.proj(); const last = ws.submissions.at(-1); log('last sub', last.rev, JSON.stringify(last.changeSet), last.rowIds.join(','))
check('M-02b 「あとで」の問題を直すと公開できる', last.rowIds.includes('R077'))
check('U-02 変更理由を数字（2 設計起因）で選べる', last.changeSet?.reason === '設計起因', JSON.stringify(last.changeSet))
check('M-28a 提出後に追加した行は変更セット（理由）を通る', !!last.changeSet)
// 「あとで」→ x（警告）で外れるか: R020 型式に前後空白を作る（公開済の行。作業中）
log(await t.setCellKey('R020', 'model', 'S-T21 AC200V '))
await t.goto('R020'); await t.colKey('model'); await t.press('Shift+ArrowRight'); log('defer R020 →', await t.toast())
await t.press('Control+Enter'); await page.waitForTimeout(80); log('publish3 (defer) →', await t.toast())
await t.goto('R020'); await t.colKey('model'); await t.press('x'); log('x →', await t.toast())
await t.press('Control+Enter'); await page.waitForTimeout(100); d = await t.panel(); log('dialog3', JSON.stringify(d)?.slice(0, 120))
if (d?.kind === 'prompt') { await t.press('6'); await page.waitForTimeout(80); if ((await t.panel())?.kind === 'prompt') { await page.keyboard.press('Enter'); await page.waitForTimeout(100) } }
log('publish3 →', await t.toast()); ws = await t.proj()
check('M-02c 「あとで」の警告を x で確認済みにすると公開できる', ws.submissions.at(-1).rowIds.includes('R020'), ws.submissions.at(-1).rowIds.join(','))

// U-05: 操作 → 1 秒待つ → リロード → Ctrl+Z
log(await t.setCellKey('R030', 'note', 'U05テスト'))
await page.waitForTimeout(1000)
await t.reload(); await page.waitForTimeout(300)
await t.press('Control+z'); await page.waitForTimeout(80); log('Ctrl+Z after reload →', await t.toast())
const r30 = await t.row('R030'); log('R030 working', JSON.stringify(r30.working))
check('U-05 リロード後に Ctrl+Z で直前の操作を戻せる', !r30.working?.note, await t.toast())

// M-30: 見積中の行に Alt+A → 理由を聞く
await t.role('purchasing'); await t.cmd('概算見積を依頼'); await page.waitForTimeout(60); await t.press('Enter'); await page.waitForTimeout(800); log('request →', await t.toast())
ws = await t.proj(); const q76 = ws.rows.find((r) => r.id === 'R076'); log('R076', q76.status)
// 1 社だけ回答（未回答あり → 見積中のまま）
await t.press('6'); log(await t.setCellKey('R076', 'q.unitPrice@S1', '1000')); log(await t.setCellKey('R076', 'q.leadDays@S1', '10'))
log('R076 status', (await t.row('R076')).status)
await t.role('design'); await t.press('1'); await t.goto('R076'); await t.press('Control+Alt+a'); await page.waitForTimeout(80)
d = await t.panel(); log('Alt+A dialog:', JSON.stringify(d)?.slice(0, 200))
check('M-30 見積中の Alt+A は理由を聞く', d?.kind === 'prompt' && /理由/.test(d.title))
if (d) { await t.press('1'); await page.waitForTimeout(80) }
const r76b = await t.row('R076'); log('R076 after', JSON.stringify({ s: r76b.status, a: r76b.adoptedSupplierId, reason: r76b.adoptReason, f: r76b.flags }))
summary(); await t.close()
