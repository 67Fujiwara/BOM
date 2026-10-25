// ラウンド11: 保存できないとき（容量いっぱい）の各操作の知らせ。V10-05 の修正（保存できなかった操作は成功を出さない）が貼り付け以外にも効くか
// 保存の失敗は 2 通りで作る: (a) 同じオリジンの別データで空きを 0 にする（実際の容量）、(b) 本体のキーへの setItem だけ QuotaExceededError を投げる（確実に失敗させる）
import { open, reset, sleep, logger, gotoCell, installToastLog, takeToasts, state } from './lib17.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`24-storage-actions-${port}.json`)
await env.context.grantPermissions(['clipboard-read', 'clipboard-write'])
const LSK = 'bom-pro.workspace.v2'
const stored = () => pg.evaluate((k) => { const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); return { rows: p.rows.length, issues: p.issues.length, hidden: p.rows.filter((r) => r.hidden).map((r) => r.id).join(','), r010: JSON.stringify(p.rows.find((r) => r.id === 'R010')).length, subs: p.submissions.length } }, LSK)
const fillTo = (free) => pg.evaluate((free) => { localStorage.removeItem('other-app-cache'); let lo = 0, hi = 6_000_000; while (hi - lo > 64) { const m = (lo + hi) >> 1; try { localStorage.setItem('probe', 'x'.repeat(m)); localStorage.removeItem('probe'); lo = m } catch { hi = m } } const n = Math.max(0, lo - free); try { localStorage.setItem('other-app-cache', 'y'.repeat(n)) } catch { return 'fail' } return { cap: lo, filled: n } }, free)
const breakSave = () => pg.evaluate((k) => { const orig = Storage.prototype.setItem; Storage.prototype.setItem = function (key, v) { if (this === window.localStorage && key === k) { const e = new DOMException('quota', 'QuotaExceededError'); throw e } return orig.call(this, key, v) } }, LSK)
const finalToast = () => pg.evaluate(() => (document.querySelector('[data-testid="toast-float"]') ?? document.querySelector('[data-testid="toast"]'))?.textContent?.slice(0, 200) ?? '')
async function run(name, { role = 'design', view = 1, row = 'R010', col = 'ID', pre = [], toks, how = 'b' }) {
  await reset(env, { role }); await gotoCell(pg, view, row, col)
  for (const t of pre) await key(t)
  if (how === 'a') await fillTo(0); else await breakSave()
  await installToastLog(pg); await takeToasts(pg)
  const before = await stored(); const seq = []
  for (const t of toks) { await key(t); await sleep(120); const s = await state(pg); seq.push(`${t}→${s.cursor}/${s.mode}${s.panel ? '{' + s.panel + '}' : ''}`) }
  await sleep(300)
  const toasts = (await takeToasts(pg)).filter((x) => !x.startsWith('保存しました')); const last = await finalToast()
  const after = await stored()
  await pg.evaluate(() => { localStorage.removeItem('other-app-cache') })
  await pg.reload(); await pg.waitForSelector('[data-testid="grid"]'); await sleep(200)
  const afterReload = await pg.evaluate((k) => { const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); return { rows: p.rows.length, issues: p.issues.length, hidden: p.rows.filter((r) => r.hidden).map((r) => r.id).join(','), subs: p.submissions.length } }, LSK).catch((e) => String(e))
  log({ name, how, seq, toasts, lastShown: last, before, afterStored: after, afterReload, successShownLast: !/保存できません|保存領域/.test(last) })
}
async function key(t) {
  if (t.startsWith('T:')) return pg.keyboard.type(t.slice(2))
  if (t.startsWith('PAL:')) { await pg.keyboard.press('Control+k'); await pg.getByTestId('palette-input').fill(t.slice(4)); await sleep(80); return pg.keyboard.press('Enter') }
  if (t.startsWith('CLIP:')) return pg.evaluate((x) => navigator.clipboard.writeText(x), t.slice(5).replace(/\\t/g, '\t').replace(/\\n/g, '\n'))
  return pg.keyboard.press(t)
}
await run('行を隠す Alt+h', { toks: ['Alt+h'] })
await run('行を追加 Shift+Enter → 部品名 abc Enter', { toks: ['Shift+Enter', 'T:abc', 'Enter'] })
await run('行を複製 Shift+D', { toks: ['Shift+D'] })
await run('行を削除 Shift+Delete（取消・作業中）', { toks: ['Shift+Delete'] })
await run('置換 Alt+r → 型式 → Enter', { toks: ['Alt+r', 'T:NEW-MODEL', 'Enter'] })
await run('警告を確認済み Alt+x（R005 型式）', { row: 'R005', col: '型式', toks: ['Alt+x'] })
await run('あとで Shift+→（R005 型式）', { row: 'R005', col: '型式', toks: ['Shift+ArrowRight'] })
await run('セルを空にする Delete（R010 部品名）', { col: '部品名', toks: ['Delete'] })
await run('指摘を起票 Alt+Shift+I → q → 本文 → Enter', { toks: ['Alt+Shift+I', 'q', 'T:確認お願いします', 'Enter'] })
await run('公開 Ctrl+Enter（R010 部品名を変えてから）', { col: '部品名', pre: ['T:PUB', 'Enter', 'ArrowUp'], toks: ['Control+Enter', 'Enter'] })
await run('Ctrl+Z（R010 部品名を変えてから）', { col: '部品名', pre: ['T:UNDO', 'Enter', 'ArrowUp'], toks: ['Control+z'] })
await run('購買 推奨で採用 Alt+a（R004）', { role: 'purchasing', view: 1, row: 'R004', col: 'ID', toks: ['Alt+a'] })
await run('購買 単価 打って Enter（R004 9）', { role: 'purchasing', view: 9, row: 'R004', col: '単価', toks: ['T:3333', 'Enter'] })
await run('行の重み w → 1 → Enter', { toks: ['Alt+w', '1', 'Enter'] })
await run('貼り付け 2 行（R079 部品名）', { row: 'R079', col: '部品名', pre: ['CLIP:A1\\tM1\\nA2\\tM2'], toks: ['Control+v'] })
await run('実容量 (a): 行を追加 Shift+Enter → abc Enter', { how: 'a', toks: ['Shift+Enter', 'T:abc', 'Enter'] })
await run('実容量 (a): 置換 Alt+r', { how: 'a', toks: ['Alt+r', 'T:NEW-MODEL-LONG-NAME-0123456789', 'Enter'] })
await run('実容量 (a): 指摘を起票', { how: 'a', toks: ['Alt+Shift+I', 'q', 'T:確認お願いします。長めの本文を入れて容量を超えるようにする。', 'Enter'] })
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
