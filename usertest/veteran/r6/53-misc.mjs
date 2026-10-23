// ラウンド6: 英字の新しい規則のまわり（V5-04・V5-05 の再確認、案内文の英字、行が無い・分類の見出しのとき、選択の列の略号、
// 編集中の Alt+Enter / F8、ステータスバーのヒントのクリック、ヘルプ・パレットの表記、ガイドで作った直後の n）
import { open, reset, gotoCell, snap, diffRows, typeSeqM, sleep, saveJson } from './lib6.mjs'
import { wizardCreate, bom300 } from './rerun5/lib.mjs'
const port = Number(process.env.PORT ?? 5173)
const env = await open(port)
const pg = env.page
const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 700)) }
const seq = (toks, g) => toks.split(' ').map((t, i) => [t, i ? g : 0])
const hints = () => pg.evaluate(() => document.querySelector('.status .hints')?.textContent ?? '')

// V5-04: 確認 → 次の行 → すぐ値（ID 列で英字のまま / 部品名で Alt）
for (const g of [0, 60, 450]) {
  await reset(env); await gotoCell(pg, 4, 'R016', 'ID')
  let a = await snap(pg)
  await typeSeqM(pg, [...seq('x j', g), ['ArrowRight', g], ['ArrowRight', g], ['ArrowRight', g], ['ArrowRight', g], ['ArrowRight', g], ...seq('c o i l', g).map(([t], i) => [t, g])])
  await sleep(200); let b = await snap(pg)
  log({ case: 'V5-04 ID: x j →→ coil', g, cursor: [a.cursor, b.cursor], mode: b.mode, edit: b.edit, panel: b.panel, diff: diffRows(a, b) })
  await reset(env); await gotoCell(pg, 4, 'R016', '部品名')
  a = await snap(pg)
  await typeSeqM(pg, [...seq('A-x A-j', g), ...seq('c o i l', g).map(([t]) => [t, g])])
  await sleep(200); b = await snap(pg)
  log({ case: 'V5-04 部品名: Alt+x Alt+j coil', g, cursor: [a.cursor, b.cursor], mode: b.mode, edit: b.edit, panel: b.panel, diff: diffRows(a, b) })
  await reset(env); await gotoCell(pg, 1, 'R040', '部品名')
  a = await snap(pg)
  await typeSeqM(pg, [...seq('A-h ArrowDown', g), ...seq('s n a p', g).map(([t]) => [t, g])])
  await sleep(200); b = await snap(pg)
  log({ case: 'V5-04 部品名: Alt+h ↓ snap', g, cursor: [a.cursor, b.cursor], mode: b.mode, edit: b.edit, panel: b.panel, diff: diffRows(a, b) })
}
// V5-05: 英字 1 打の直後の Esc / Backspace / Enter / Tab（備考）
for (const [name, toks] of [['h Esc', 'h Escape'], ['h Backspace', 'h Backspace'], ['A Enter', 'A Enter'], ['x Tab', 'x Tab'], ['h Esc（ID 列）', 'h Escape']]) {
  for (const g of [0, 60, 350]) {
    await reset(env); await gotoCell(pg, 1, 'R040', name.includes('ID') ? 'ID' : '備考')
    const a = await snap(pg)
    await typeSeqM(pg, seq(toks, g)); await sleep(200)
    const b = await snap(pg)
    log({ case: 'V5-05 ' + name, g, mode: b.mode, edit: b.edit, cursor: b.cursor, diff: diffRows(a, b), toast: b.toast })
  }
}
// 選択の列の 1 文字の略号（k → 個 など）と日付・数値の列での英字
for (const [col, word] of [['単位', 'k'], ['単位', 'h'], ['単位', 'S'], ['調達区分', 'a'], ['代替可否', 'n'], ['メーカ指定', 'r'], ['必要数', 'x'], ['必要日(固定)', 'j']]) {
  await reset(env); await gotoCell(pg, 1, 'R040', col)
  const a = await snap(pg)
  await typeSeqM(pg, [...seq([...word].join(' '), 0), ['Enter', 30]]); await sleep(150)
  const b = await snap(pg)
  log({ case: `select/num/date: ${col} ← ${word} Enter`, mode: b.mode, edit: b.edit, cursor: b.cursor, panel: b.panel, view: b.view, diff: diffRows(a, b), toast: b.toast })
}
// カーソルの行が無いとき・分類の見出しのときに語を打つ
await reset(env)
{
  const a = await snap(pg)
  await typeSeqM(pg, seq('A n a l o g', 30)); await sleep(200)
  const b = await snap(pg)
  log({ case: '起動直後（行を選んでいない）に Analog', cursor: [a.cursor, b.cursor], mode: b.mode, edit: b.edit, panel: b.panel, view: b.view, chips: b.chips, diff: diffRows(a, b), toast: b.toast })
}
await reset(env); await pg.keyboard.press('1'); await sleep(30); await pg.keyboard.press('ArrowDown'); await pg.keyboard.press(']'); await sleep(50)
{
  const a = await snap(pg)
  await typeSeqM(pg, seq('h o o k', 30)); await sleep(200)
  const b = await snap(pg)
  log({ case: '分類の見出しで hook', cursor: [a.cursor, b.cursor], mode: b.mode, edit: b.edit, panel: b.panel, view: b.view, chips: b.chips, diff: diffRows(a, b), toast: b.toast })
}
// 絞り込みで 0 行のときに語を打つ
await reset(env); await gotoCell(pg, 1, 'R040', '部品名')
await pg.keyboard.press('/'); await pg.keyboard.type('zzzz-no-such'); await pg.keyboard.press('Enter'); await sleep(80)
{
  const a = await snap(pg)
  await typeSeqM(pg, seq('c o i l', 30)); await sleep(200)
  const b = await snap(pg)
  log({ case: '絞り込み 0 行で coil', cursor: [a.cursor, b.cursor], mode: b.mode, edit: b.edit, panel: b.panel, chips: b.chips, diff: diffRows(a, b), toast: b.toast })
}
// 編集中の Alt+Enter・F8・Alt+x
for (const k of ['Alt+Enter', 'F8', 'Alt+KeyX', 'Alt+KeyN']) {
  await reset(env); await gotoCell(pg, 1, 'R040', '備考')
  const a = await snap(pg)
  await pg.keyboard.type('一行目'); await pg.keyboard.press(k); await pg.keyboard.type('二'); await sleep(100)
  const b = await snap(pg)
  log({ case: '編集中に ' + k, mode: b.mode, edit: b.edit, cursor: b.cursor, diff: diffRows(a, b), toast: b.toast })
}
// ステータスバーのヒント（文字を打てる列 / ID 列 / 購買 / PM）とクリック
for (const [role, view, row, col] of [['design', 4, 'R016', '部品名'], ['design', 4, 'R016', 'ID'], ['design', 1, 'R040', '型式'], ['purchasing', 9, null, '単価'], ['purchasing', 1, 'R040', '部品名'], ['pm', 7, null, null]]) {
  await reset(env, { role })
  if (row) await gotoCell(pg, view, row, col)
  else { await pg.keyboard.press(String(view)); await sleep(30); await pg.keyboard.press('ArrowDown'); if (col) { await pg.keyboard.press('Home'); for (let i = 0; i < 60 && !(await pg.getByTestId('cursor').textContent()).endsWith(' ' + col); i++) await pg.keyboard.press('ArrowRight') } }
  log({ case: 'ヒント', role, view, cursor: await pg.getByTestId('cursor').textContent(), hints: await hints() })
}
await reset(env); await gotoCell(pg, 1, 'R040', '部品名')
{
  const a = await snap(pg)
  const n = await pg.locator('.status .hints .clickable', { hasText: '推奨採用' }).count()
  if (n) await pg.locator('.status .hints .clickable', { hasText: '推奨採用' }).click()
  await sleep(150)
  const b = await snap(pg)
  log({ case: 'ヒント「Ctrl+Alt+A 推奨採用」をクリック', found: n, diff: diffRows(a, b), toast: b.toast })
}
// パレット: 文字を打てる列にいるとき、操作の横に出るキー
await reset(env); await gotoCell(pg, 1, 'R040', '部品名')
await pg.keyboard.press('Control+k'); await pg.getByTestId('palette-input').fill('隠す'); await sleep(60)
log({ case: 'パレット「隠す」の表記（部品名）', items: await pg.evaluate(() => [...document.querySelectorAll('[data-testid="palette-list"] .item')].slice(0, 4).map((e) => e.textContent)) })
await pg.getByTestId('palette-input').fill('次の問題'); await sleep(60)
log({ case: 'パレット「次の問題」の表記（部品名）', items: await pg.evaluate(() => [...document.querySelectorAll('[data-testid="palette-list"] .item')].slice(0, 4).map((e) => e.textContent)) })
await pg.keyboard.press('Escape')
await pg.keyboard.press('?'); await sleep(80)
log({ case: 'ヘルプの冒頭', text: (await pg.locator('[data-testid^="panel-"]').first().innerText().catch(() => '')).slice(0, 400) })
await pg.keyboard.press('Escape')
// ガイドで作った直後: 案内「n で次の問題へ」どおり n を押す
await reset(env)
{
  const lines = ['部品名\t型式\tメーカ\t員数', 'リレー\t\tオムロン\t2', '端子台\tXW2B-20G4\t\t', 'ヒューズ\tF-1A\tSOC\t0', 'コネクタ\tXH-2P\tJST\t4']
  const r = await wizardCreate(pg, 'P-R6N', lines.join('\n'))
  const t = await pg.evaluate(() => (document.querySelector('[data-testid="toast-float"]') ?? document.querySelector('[data-testid="toast"]'))?.textContent ?? '')
  const a = await snap(pg)
  await pg.keyboard.press('n'); await sleep(100)
  const b = await snap(pg)
  log({ case: 'ガイド作成直後に n', wizard: r, toast: t.slice(0, 160), cursor: [a.cursor, b.cursor], mode: b.mode, edit: b.edit, hints: await hints() })
  await pg.keyboard.press('Escape')
}
// 隠した後の案内「h でもう一度押すと戻る」どおり h（部品名）
await reset(env); await gotoCell(pg, 1, 'R040', '部品名')
{
  await pg.keyboard.press('Alt+KeyH'); await sleep(80)
  const t = (await snap(pg)).toast
  const a = await snap(pg)
  await pg.keyboard.press('k'); await sleep(50); await pg.keyboard.press('h'); await sleep(100)
  const b = await snap(pg)
  log({ case: 'Alt+h のあと案内どおり k → h', toast: t, cursor: [a.cursor, b.cursor], mode: b.mode, edit: b.edit, diff: diffRows(a, b) })
}
log({ errors: env.errs })
await env.browser.close()
saveJson(process.env.OUT ?? `53-misc-${port}.json`, out)
