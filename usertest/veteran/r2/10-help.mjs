// ヘルプの網羅性（keymap.ts の全エントリ）とパレットの名前実行
import { launch, fresh, sleep, dumpErrors, save2, shot2 } from './lib.mjs'
import { parseKeymap } from '../keymap-parse.mjs'
const KM = parseKeymap()
const { browser, page, errors } = await launch()
const out = {}
await fresh(page)
await page.keyboard.press('?'); await sleep(50)
const helpText = (await page.getByTestId('help').textContent()) ?? ''
const helpRows = await page.evaluate(() => [...document.querySelectorAll('[data-testid="help"] section')].map((s) => ({ h: s.querySelector('h3,h4,header,div')?.textContent, rows: [...s.querySelectorAll('tr, li, .row, div.k')].map((r) => r.textContent).slice(0, 80) })))
const fmt = (k) => (k === ' ' ? 'Space' : k.replace('ArrowUp', '↑').replace('ArrowDown', '↓').replace('ArrowLeft', '←').replace('ArrowRight', '→').replace('Escape', 'Esc'))
const missingLabel = KM.filter((b) => !helpText.includes(b.label)).map((b) => b.id + ':' + b.label)
const missingKey = KM.flatMap((b) => b.keys.map((k) => ({ b, k }))).filter(({ k }) => !helpText.includes(fmt(k))).map(({ b, k }) => b.id + ':' + JSON.stringify(k))
// ヘルプが画面に収まるか・スクロールできるか
const fit = await page.evaluate(() => { const d = document.querySelector('[data-testid="panel-help"] .dialog') ?? document.querySelector('[data-testid="help"]'); const r = d.getBoundingClientRect(); let sc = null; for (const e of [d, ...d.querySelectorAll('*')]) if (e.scrollHeight > e.clientHeight + 2 && getComputedStyle(e).overflowY !== 'visible') { sc = { sh: e.scrollHeight, ch: e.clientHeight, cls: e.className }; break } return { top: r.top, bottom: r.bottom, vh: innerHeight, scrollable: sc } })
await shot2(page, '10-help')
await page.setViewportSize({ width: 1280, height: 720 }); await sleep(100)
const fit720 = await page.evaluate(() => { const d = document.querySelector('[data-testid="panel-help"] .dialog') ?? document.querySelector('[data-testid="help"]'); const r = d.getBoundingClientRect(); let sc = null; for (const e of [d, ...d.querySelectorAll('*')]) if (e.scrollHeight > e.clientHeight + 2 && getComputedStyle(e).overflowY !== 'visible') { sc = { sh: e.scrollHeight, ch: e.clientHeight, cls: e.className }; break } return { top: r.top, bottom: r.bottom, vh: innerHeight, scrollable: sc } })
// ↓ / PageDown / End でヘルプがスクロールするか
const sc0 = await page.evaluate(() => { let m = []; document.querySelectorAll('[data-testid="panel-help"] *').forEach((e) => { if (e.scrollHeight > e.clientHeight + 2) m.push(e.scrollTop) }); return m })
for (const k of ['ArrowDown', 'ArrowDown', 'PageDown', 'End', 'Space']) await page.keyboard.press(k)
const sc1 = await page.evaluate(() => { let m = []; document.querySelectorAll('[data-testid="panel-help"] *').forEach((e) => { if (e.scrollHeight > e.clientHeight + 2) m.push(e.scrollTop) }); return m })
await shot2(page, '10-help-720')
await page.keyboard.press('Escape')
await page.setViewportSize({ width: 1440, height: 900 })
// パレット: keymap の label で引いたら先頭がそのコマンドか
const pal = []
for (const b of KM) {
  await page.keyboard.press('Control+k')
  await page.getByTestId('palette-input').fill(b.label)
  await sleep(10)
  const items = await page.evaluate(() => [...document.querySelectorAll('[data-testid="palette-list"] .item')].map((el) => el.children[1]?.textContent ?? el.textContent))
  const firstIsSelf = items[0] === b.label || (items[0] ?? '').startsWith(b.label)
  const anywhere = items.findIndex((x) => x === b.label || x.startsWith(b.label))
  if (!firstIsSelf) pal.push({ id: b.id, label: b.label, first: items[0], positionOfSelf: anywhere })
  await page.keyboard.press('Escape')
}
// STATIC（パレット専用）の全コマンドも同様に
const staticLabels = ['公開（提出 / 指摘を発行）', '概算見積を依頼', '見積回答を取り込む', '未採用を推奨で一括採用', '未採用を最安で一括採用（スコア無視）', '商社を集約', '正式見積を依頼（社外）', '選定記録を出力（社内）', '先行発注を申請', '元に戻す', 'やり直す', '保存', '行を削除（提出済なら取消）', '行を追加', '案件設定', '案件設定を確定（PM）', '新しいBOM', '受信箱・案件を切り替える', 'ルールを追加', 'Excelで出力', '表示中の行と列を書式つきでコピー', 'JSON を書き出す', 'JSON を読み込む', 'サンプルデータに戻す', '商社を追加', '役割を切り替え（ログイン）', '履歴', 'ダークモード切替', 'コンパクト表示切替', 'ショートカット一覧（ヘルプ）']
const pal2 = []
for (const label of staticLabels) {
  await page.keyboard.press('Control+k')
  await page.getByTestId('palette-input').fill(label)
  await sleep(10)
  const items = await page.evaluate(() => [...document.querySelectorAll('[data-testid="palette-list"] .item')].map((el) => el.children[1]?.textContent ?? el.textContent))
  if (items[0] !== label) pal2.push({ typed: label, first: items[0], positionOfSelf: items.indexOf(label) })
  await page.keyboard.press('Escape')
}
// 最近使ったコマンドの並び
for (const c of ['ダークモード切替', 'コンパクト表示切替']) { await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill(c); await page.keyboard.press('Enter'); await sleep(30) }
await page.keyboard.press('Control+k'); await sleep(20)
const recentTop = await page.evaluate(() => [...document.querySelectorAll('[data-testid="palette-list"] .item')].slice(0, 3).map((el) => el.children[1]?.textContent))
await page.keyboard.press('Escape')
for (const c of ['ダークモード切替', 'コンパクト表示切替']) { await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill(c); await page.keyboard.press('Enter'); await sleep(30) }
out.help = { entries: KM.length, keys: KM.flatMap((b) => b.keys).length, missingLabel, missingKey, fit, fit720, scrollBefore: sc0, scrollAfterKeys: sc1 }
out.palette = { keymapNotFirst: pal, staticNotFirst: pal2, recentTop }
console.log(JSON.stringify(out, null, 1).slice(0, 5000))
save2('10-help.json', out)
dumpErrors(errors, 'help')
await browser.close()
