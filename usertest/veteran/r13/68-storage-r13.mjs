// ラウンド13: 「ほぼいっぱい」（空き 2KB）で、小さい変更は入り大きい変更だけ入らない状態を、あらゆる操作で。知らせとリロード後の中身が合っているか
import { open, reset, sleep, logger, gotoCell, installToastLog, takeToasts, state } from './lib13.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`68-storage-r13-${port}${process.env.PART2 ? '-b' : ''}.json`)
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
  if (t.startsWith('FILE:')) { await p.getByTestId('wizard-file').setInputFiles('/home/user/BOM/usertest/veteran/r13/dl/' + t.slice(5)); return sleep(2500) }
  if (t === 'FIX') return fixSave(p)
  if (t === 'FULL') return fillTo(0, p)
  if (t.startsWith('NEAR:')) return fillTo(Number(t.slice(5)), p)
  if (t === 'RELOAD') { await p.reload(); await p.waitForSelector('[data-testid="grid"]'); await p.locator('.gridwrap').focus(); return sleep(300) }
  if (t === 'BREAK') return breakSave(p)
  return p.keyboard.press(t)
}
const snapAll = () => pg.evaluate((k) => { const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); return { projects: w.projects.length, cur: w.currentProjectId, rows: p.rows.length, issues: p.issues.length, revs: p.submissions.length, r010: p.rows.find((x) => x.id === 'R010')?.working?.name ?? p.rows.find((x) => x.id === 'R010')?.name, r004: p.rows.find((x) => x.id === 'R004')?.status, role: w.user.role } }, LSK)
async function run(name, { role = 'design', free = 2000, toks, expect }) {
  await reset(env, { role }); await gotoCell(pg, 1, 'R010', '部品名')
  await fillTo(free)
  await installToastLog(pg); await takeToasts(pg)
  const before = await snapAll()
  const seq = []
  for (const t of toks) { await key(t); await sleep(250); const s = await state(pg); seq.push(`${t}→${s.cursor}/${s.mode}${s.panel ? '{' + s.panel + '}' : ''} «${(await toastInfo()).slice(0, 140)}»`) }
  const screen = await pg.evaluate(() => ({ rows: document.querySelectorAll('[data-testid="grid"] [data-row-id]').length, title: document.title }))
  const stored0 = await snapAll()
  await key('RELOAD')
  const afterReload = await snapAll()
  log({ name, expect, before, seq, toasts: (await takeToasts(pg)).slice(-6), storedBeforeReload: stored0, afterReload })
  await freeUp()
}
if (!process.env.PART2) {
await run('N1 空き 2KB: 部品名 1 文字 → 指摘を起票（Shift+I q 本文 Enter）', { toks: ['T:A', 'Enter', 'ArrowUp', 'Shift+I', 'q', 'T:確認お願いします。長めの本文を書いておきます。'.repeat(3), 'Enter'], expect: '小さい編集は保存・指摘は保存できないと知らせる' })
await run('N2 空き 2KB: 新しいBOM（ガイド → 3 1 つずつ → 作成）', { toks: ['PAL:新しいBOM', 'T:P-NEAR', 'Enter', 'Enter', 'Enter', 'Enter', 'Enter', 'Enter', 'Enter', '3', 'Enter', 'Enter'], expect: '作れなければ知らせる' })
await run('N3 空き 2KB: 公開（Ctrl+Enter → 2 → Enter）', { toks: ['T:PUB', 'Enter', 'Control+Enter', '2', 'Enter'], expect: '保存できていないと知らせる' })
await run('N4 空き 2KB: 採用（R004 a）→ Ctrl+Z → Ctrl+Y', { toks: ['G:R004', 'Home', 'a', 'Control+z', 'Control+y'], expect: '一貫した知らせ' })
await run('N5 空き 2KB: 行を 5 行追加（Shift+Enter ×5）', { toks: ['Shift+Enter', 'Escape', 'Shift+Enter', 'Escape', 'Shift+Enter', 'Escape', 'Shift+Enter', 'Escape', 'Shift+Enter', 'Escape'], expect: '?' })
await run('N6 空き 2KB: 役割の切り替え（購買）→ 発注数', { toks: ['PAL:役割を切り替え', '2', 'Enter'], expect: '?' })
await run('N7 空き 0: 新しいBOM', { free: 0, toks: ['PAL:新しいBOM', 'T:P-FULL', 'Enter', 'Enter', 'Enter', 'Enter', 'Enter', 'Enter', 'Enter', '3', 'Enter', 'Enter'], expect: '作れなければ知らせる・リロード後に前の案件' })
await run('N8 空き 2KB: 案件設定（納期を変える）', { toks: ['PAL:案件設定', 'Enter'], expect: '?' })
} else {
await run('N1b 空き 2KB: ID の列で指摘を起票（Shift+I → q → 長い本文 → Enter）', { toks: ['Home', 'Shift+I', 'q', 'T:' + '確認お願いします。長めの本文を書いておきます。'.repeat(40), 'Enter'], expect: '保存できなければ知らせる' })
await run('N9 空き 2KB: 2,500 行の Excel から新しいBOM', { toks: ['PAL:新しいBOM', 'T:P-XL', 'Enter', 'Enter', 'Enter', 'Enter', 'Enter', 'Enter', 'Enter', '2', 'FILE:m5-2500-pages.xlsx', 'Enter', 'Enter'], expect: '作れなければ知らせる' })
}
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
