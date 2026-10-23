// ラウンド10: 英字・数字・記号で始まる語を、列の種類 × 役割 × 行なし・見出しで打って Enter（ページ内 0ms / 40ms）。
// 書ける列は値がそのまま入るか、書けない列・行なし・見出しはビュー・絞り込み・パネル・データが変わらないか
import { open, reset, gotoCell, snap, diffRows, sleep, state, logger, installToastLog, takeToasts, typeSeqM } from './lib13.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`03-entry-matrix-${port}.json`)
const WORDS = (process.env.WORDS ?? 'abc,Abc,1N4148,47,<5mm,>85,[A]1,/30,?x,-5,+5,#3,@x,*2,.5,~1,=1,x/y,11/30').split(',')
const GAPS = [0, 40]
// [名前, 役割, 準備, 書ける列か]
const STATES = [
  ['設計 1 部品名（文字）', 'design', async () => gotoCell(pg, 1, 'R010', '部品名'), true],
  ['設計 1 必要数（数）', 'design', async () => gotoCell(pg, 1, 'R010', '必要数'), true],
  ['設計 1 単位（選択）', 'design', async () => gotoCell(pg, 1, 'R010', '単位'), true],
  ['設計 1 必要日（自動）', 'design', async () => gotoCell(pg, 1, 'R010', '必要日'), false],
  ['設計 1 ボール（自動）', 'design', async () => gotoCell(pg, 1, 'R010', 'ボール'), false],
  ['設計 1 期限（自動）', 'design', async () => gotoCell(pg, 1, 'R010', '期限'), false],
  ['設計 3 入荷予定（購買の列）', 'design', async () => gotoCell(pg, 3, 'R001', '入荷予定'), false],
  ['設計 3 発注（チェック）', 'design', async () => gotoCell(pg, 3, 'R001', '発注'), false],
  ['設計 分類の見出し', 'design', async () => { await gotoCell(pg, 1, 'R001', '部品名'); await pg.keyboard.press('ArrowUp') }, false],
  ['設計 行なし（4 で直して Tab）', 'design', async () => { await gotoCell(pg, 4, 'R054', '必要数'); await pg.keyboard.type('5'); await pg.keyboard.press('Tab') }, false],
  ['購買 3 入荷予定（日付）', 'purchasing', async () => gotoCell(pg, 3, 'R001', '入荷予定'), true],
  ['購買 3 発注（チェック）', 'purchasing', async () => gotoCell(pg, 3, 'R001', '発注'), false],
  ['購買 9 部品名（設計の列）', 'purchasing', async () => gotoCell(pg, 9, 'R020', '部品名'), false],
  ['PM 7 部品名', 'pm', async () => gotoCell(pg, 1, 'R010', '部品名'), false],
]
const only = process.env.ONLY
for (const [name, role, prep, editable] of STATES) {
  if (only && !name.includes(only)) continue
  for (const w of WORDS) for (const gap of GAPS) {
    await reset(env, { role }); await prep(); await sleep(60)
    await installToastLog(pg); await takeToasts(pg)
    const s0 = await state(pg); const a = await snap(pg)
    await typeSeqM(pg, [...[...w].map((ch, i) => [ch === '-' ? '-' : ch, i ? gap : 0]), ['Enter', gap]]); await sleep(120)
    const s1 = await state(pg); const b = await snap(pg)
    const diff = diffRows(a, b)
    const changedView = s0.view !== s1.view, panel = s1.panel, filter = s1.filter
    const rec = { name, w, gap, editable, start: s0.cursor, after: `${s1.view}/${s1.cursor}/${s1.mode}${panel ? '/' + panel : ''}${filter ? '/f=' + filter : ''}`, diff, toasts: (await takeToasts(pg)).filter((t) => !t.startsWith('保存しました')).slice(0, 2) }
    // 判定: 書ける列 → その行のその列だけが変わる（数の列の読めない語はエラーで編集のまま）。書けない → 何も変わらない
    rec.bad = editable ? (diff.some((d) => !d.startsWith(s0.cursor.split(' ')[0])) || changedView || !!panel || !!filter) : (diff.length > 0 || changedView || !!panel || !!filter)
    log(rec)
    for (let i = 0; i < 3; i++) await pg.keyboard.press('Escape')
  }
}
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
