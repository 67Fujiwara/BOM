// ラウンド12: 保存できないときの知らせ（V10-05 の修正: 保存できていない変更があるあいだは成功の通知にも「保存できていません」）の境目
// Ctrl+S・ナビの知らせ・空きができたあと・別のタブの保存・Undo/Redo・JSON の読み込み・役割の切り替え・退避データを消す
import { open, reset, sleep, logger, gotoCell, installToastLog, takeToasts, state } from './lib13.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`44-storage-flag-${port}.json`)
await env.context.grantPermissions(['clipboard-read', 'clipboard-write'])
const LSK = 'bom-pro.workspace.v2'
const stored = (p = pg) => p.evaluate((k) => { const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); const r = p.rows.find((x) => x.id === 'R010'); return { rows: p.rows.length, r010: r.working?.name ?? r.name, r011: (p.rows.find((x) => x.id === 'R011').working?.name ?? p.rows.find((x) => x.id === 'R011').name), hidden: p.rows.filter((r) => r.hidden).map((r) => r.id).join(','), user: w.user.role } }, LSK)
const fillTo = (free, p = pg) => p.evaluate((free) => { localStorage.removeItem('other-app-cache'); let lo = 0, hi = 6_000_000; while (hi - lo > 64) { const m = (lo + hi) >> 1; try { localStorage.setItem('probe', 'x'.repeat(m)); localStorage.removeItem('probe'); lo = m } catch { hi = m } } const n = Math.max(0, lo - free); localStorage.setItem('other-app-cache', 'y'.repeat(n)); return { cap: lo, filled: n } }, free)
const freeUp = (p = pg) => p.evaluate(() => localStorage.removeItem('other-app-cache'))
const breakSave = (p = pg) => p.evaluate((k) => { const orig = Storage.prototype.setItem; window.__origSet = orig; Storage.prototype.setItem = function (key, v) { if (this === window.localStorage && key === k && !window.__fixed) throw new DOMException('quota', 'QuotaExceededError'); return orig.call(this, key, v) } }, LSK)
const fixSave = (p = pg) => p.evaluate(() => { window.__fixed = true })
const toastInfo = (p = pg) => p.evaluate(() => { const t = document.querySelector('[data-testid="toast-float"]') ?? document.querySelector('[data-testid="toast"]'); return t ? `${t.className.match(/err|ok|info/g)?.join('/') ?? ''}|${t.textContent.slice(0, 150)}` : '' })
async function key(t, p = pg) {
  if (t.startsWith('T:')) return p.keyboard.type(t.slice(2))
  if (t.startsWith('G:')) { await p.keyboard.press('Control+g'); await p.getByTestId('prompt-text').fill(t.slice(2)); return p.keyboard.press('Enter') }
  if (t.startsWith('PAL:')) { await p.keyboard.press('Control+k'); await p.getByTestId('palette-input').fill(t.slice(4)); await sleep(100); return p.keyboard.press('Enter') }
  if (t === 'FREE') return freeUp(p)
  if (t === 'FIX') return fixSave(p)
  if (t === 'FULL') return fillTo(0, p)
  if (t === 'BREAK') return breakSave(p)
  return p.keyboard.press(t)
}
async function run(name, { role = 'design', how = 'b', toks, expect }) {
  await reset(env, { role }); await gotoCell(pg, 1, 'R010', '部品名')
  if (how === 'a') await fillTo(0); else if (how === 'b') await breakSave()
  await installToastLog(pg); await takeToasts(pg)
  const seq = []
  for (const t of toks) { await key(t); await sleep(150); const s = await state(pg); seq.push(`${t}→${s.cursor}/${s.mode}${s.panel ? '{' + s.panel + '}' : ''} «${(await toastInfo()).slice(0, 110)}»`) }
  const st = await stored()
  await freeUp(); await fixSave()
  await pg.reload(); await pg.waitForSelector('[data-testid="grid"]'); await sleep(200)
  log({ name, how, expect, seq, storedBefore: st, afterReload: await stored() })
}
await run('F1 保存できない → 部品名 A1 → Ctrl+S', { toks: ['T:A1', 'Enter', 'Control+s'], expect: '「保存できませんでした」（「保存しました」と言わない）' })
await run('F2 保存できない → 部品名 A1 → ↓ → 文字を打たずに F8・Alt+4 の知らせ', { toks: ['T:A1', 'Enter', 'F8', 'Alt+3', 'F8'], expect: 'ナビの知らせも「保存できていません」付き？' })
await run('F3 保存できない → A1 → 空きを作る（他のデータを消す）→ Ctrl+S', { how: 'a', toks: ['T:A1', 'Enter', 'FREE', 'Control+s'], expect: '保存しました（リロード後 A1 が残る）' })
await run('F4 保存できない → A1 → 空きを作る → 部品名 B1（次の操作）', { how: 'a', toks: ['T:A1', 'Enter', 'FREE', 'T:B1', 'Enter'], expect: '保存される（A1・B1 とも）、通知は普通' })
await run('F5 保存できない → A1 → 空きを作る → F8（操作なし）', { how: 'a', toks: ['T:A1', 'Enter', 'FREE', 'F8'], expect: '?（まだ保存していないので「保存できていません」は正しい）' })
await run('F6 保存できない → A1 → Ctrl+Z', { toks: ['T:A1', 'Enter', 'Control+z'], expect: '「保存できていません: 元に戻す」' })
await run('F7 保存できない → A1 → Ctrl+Z → Ctrl+Y', { toks: ['T:A1', 'Enter', 'Control+z', 'Control+y'], expect: '同上' })
await run('F8 保存できない → 退避データを消す（パレット）', { toks: ['T:A1', 'Enter', 'PAL:退避データを消す', 'Enter'], expect: '?' })
await run('F9 保存できない → 役割を切り替え（購買）', { toks: ['T:A1', 'Enter', 'PAL:役割を切り替え', '2', 'Enter'], expect: '「保存できていません」付き' })
await run('F10 保存できない → A1 → 保存できる → 何もしない（FIX）→ Ctrl+S', { toks: ['T:A1', 'Enter', 'FIX', 'Control+s'], expect: '保存しました' })
// 2 タブ: A だけ保存できない（setItem を壊す）→ A で R010 を A1 → B で R011 を B1（B は保存できる）→ A の画面・A の次の通知
{
  await reset(env); const pgB = await env.context.newPage(); await pgB.goto(env.url); await pgB.waitForSelector('[data-testid="grid"]'); await pgB.locator('.gridwrap').focus()
  await gotoCell(pg, 1, 'R010', '部品名'); await gotoCell(pgB, 1, 'R011', '部品名')
  await breakSave(pg); await installToastLog(pg); await takeToasts(pg)
  const seq = []
  await key('T:A1'); await key('Enter'); await sleep(200); seq.push('A: A1 Enter «' + (await toastInfo()) + '»')
  const aScreen = () => pg.evaluate(() => [...document.querySelectorAll('[data-row-id="R010"] td, [data-row-id="R010"] [role=gridcell]')].map((e) => e.textContent).join('|').slice(0, 80))
  seq.push('A 画面 R010: ' + await aScreen())
  await key('T:B1', pgB); await key('Enter', pgB); await sleep(500); seq.push('B: B1 Enter «' + (await toastInfo(pgB)) + '»')
  seq.push('A 画面 R010（B の保存の後）: ' + await aScreen())
  await key('ArrowDown'); await key('F8'); await sleep(200); seq.push('A: F8 «' + (await toastInfo()) + '»')
  await key('T:A2'); await key('Enter'); await sleep(200); seq.push('A: A2 Enter «' + (await toastInfo()) + '»')
  const st = await stored(pgB)
  log({ name: 'F11 2 タブ: A だけ保存できない → A の A1 → B の保存（storage イベント）で A の画面は？', seq, storedB: st, takeA: (await takeToasts(pg)).slice(-5) })
  await pgB.close()
}
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
