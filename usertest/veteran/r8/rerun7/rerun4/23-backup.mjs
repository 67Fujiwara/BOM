// ラウンド4: 退避の複数化・戻す/書き出すの選択・壊れた画面からの復元・容量ぎりぎりでの退避
import fs from 'node:fs'
import path from 'node:path'
import { launch, fresh, goto, toCol, sleep, dumpErrors, save, panel, palette, toastNow, ws, shot, DL, LS_KEY } from './lib.mjs'
const { browser, page, errors } = await launch({ acceptDialogs: true })
const out = {}
const BK = 'bom-pro.workspace.backup'
const crash = async () => page.getByTestId('crash').count()
const backups = () => page.evaluate((k) => { const v = JSON.parse(localStorage.getItem(k) ?? 'null'); const a = Array.isArray(v) ? v : v ? [v] : []; return a.map((b) => ({ at: b.at, reason: b.reason, len: b.raw.length, ids: (() => { try { return JSON.parse(b.raw).projects?.map((p) => p.id) } catch { return 'unparsable' } })() })) }, BK)
const lsUsage = () => page.evaluate(() => { let n = 0; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); n += k.length + (localStorage.getItem(k)?.length ?? 0) } return n })
async function importJson(text, choose = 'yes') {
  await palette(page, 'JSON を読み込む'); await sleep(40)
  await page.evaluate((t) => { const el = document.querySelector('[data-testid="import-text"]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, t); el.dispatchEvent(new Event('input', { bubbles: true })) }, text)
  await page.getByTestId('import-text').focus()
  await page.keyboard.press('Control+Enter'); await sleep(80)
  const texts = []
  for (let i = 0; i < 3; i++) {
    const p = await panel(page)
    if (!p) break
    texts.push((await page.locator('[data-testid^="panel-"]').first().innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200))
    const c = Array.isArray(choose) ? choose[i] ?? 'yes' : choose
    if (c === 'yes') { await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter') } else { await page.keyboard.press('Enter') }
    await sleep(100)
  }
  return { texts, toast: (await toastNow(page)).slice(0, 200) }
}
async function baseWs() { await page.keyboard.press('Control+s'); return ws(page) }
function mkWs(base, id, extraRows = 0) {
  const w = structuredClone(base); const p = w.projects[0]; p.id = id; p.name = id; w.currentProjectId = id
  for (let i = 0; i < extraRows; i++) { const r = structuredClone(p.rows[i % p.rows.length]); r.id = 'Z' + i; r.note = 'n'.repeat(200); p.rows.push(r) }
  return w
}

if (!process.env.ONLY || process.env.ONLY.includes('A'))
// ---- A. 読めなかった保存データ → JSON 読み込み ×4 → 読めなかったデータの退避は残るか。一覧から選んで戻す・書き出す
{
  await fresh(page)
  const base = await baseWs()
  const real = mkWs(base, 'P-REAL')
  const rawBroken = JSON.stringify(real).slice(0, -500) // 末尾が欠けた（書き込み中の異常終了）
  await page.evaluate(([k, s]) => localStorage.setItem(k, s), [LS_KEY, rawBroken])
  await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await sleep(200)
  const t0 = await toastNow(page)
  const b0 = await backups()
  for (let i = 1; i <= 4; i++) await importJson(JSON.stringify(mkWs(base, 'P-IMP' + i)))
  const b1 = await backups()
  // 一覧を開いて選択肢を見る
  await page.locator('.gridwrap').focus()
  await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('読み込み前に戻す'); await page.keyboard.press('Enter'); await sleep(80)
  const listText = (await page.locator('[data-testid^="panel-"]').first().innerText().catch(() => '')).replace(/\s+/g, ' ')
  const opts = await page.locator('[data-testid^="panel-"] .opt, [data-testid^="panel-"] li, [data-testid^="panel-"] .item').allTextContents().catch(() => [])
  // 読めなかったデータを選ぶ → 読めないので理由が出るはず。書き出しは元のバイト列と一致するか
  const brokenIdx = opts.findIndex((o) => o.includes('読めなかった'))
  if (brokenIdx >= 0) { for (let k = 0; k < brokenIdx; k++) await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await sleep(100) }
  const restoreBrokenToast = await toastNow(page)
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape')
  await page.locator('.gridwrap').focus()
  const dlP = page.waitForEvent('download', { timeout: 3000 }).catch(() => null)
  await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('退避したデータを書き出す'); await page.keyboard.press('Enter'); await sleep(80)
  const opts2 = await page.locator('[data-testid^="panel-"] .opt, [data-testid^="panel-"] li, [data-testid^="panel-"] .item').allTextContents().catch(() => [])
  const bi2 = opts2.findIndex((o) => o.includes('読めなかった'))
  if (bi2 >= 0) { for (let k = 0; k < bi2; k++) await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter') }
  const dl = await dlP
  let same = null
  if (dl) { const f = path.join(DL, 'A-broken.json'); await dl.saveAs(f); same = fs.readFileSync(f, 'utf8') === rawBroken }
  // 一覧の 2 番目（JSON 読み込みの前）に戻す
  await page.locator('.gridwrap').focus()
  await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('読み込み前に戻す'); await page.keyboard.press('Enter'); await sleep(80)
  await page.keyboard.press('2'); await sleep(80)
  const confirmText = (await page.locator('[data-testid^="panel-"]').first().innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200)
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await sleep(100)
  const afterRestore = { ids: (await ws(page)).projects.map((p) => p.id), toast: await toastNow(page), backups: await backups() }
  out.A = { loadToast: t0.slice(0, 200), backupsAfterLoad: b0, backupsAfter4Imports: b1, listText: listText.slice(0, 600), opts, restoreBrokenToast, exportOpts: opts2, exportSame: same, confirmText, afterRestore }
  console.log('A', JSON.stringify(out.A).slice(0, 2500))
}

if (!process.env.ONLY || process.env.ONLY.includes('B'))
// ---- B. 壊れた画面の「退避したデータに戻す」: JSON 読み込みで壊れた → リロードしても壊れる → ボタンで戻る
{
  await fresh(page)
  const base = await baseWs()
  await importJson(JSON.stringify(mkWs(base, 'P-ORIG')))
  const bad = mkWs(base, 'P-BAD'); bad.suppliers[0] = null
  await importJson(JSON.stringify(bad))
  const c1 = await crash()
  await page.reload(); await page.waitForSelector('[data-testid="grid"], [data-testid="crash"]'); await sleep(150)
  const c2 = await crash()
  const btns = c2 ? await page.locator('[data-testid="crash"] button').allTextContents() : []
  let after = null
  if (c2) {
    await page.locator('[data-testid="crash"] button', { hasText: '退避したデータに戻す' }).click()
    await page.waitForSelector('[data-testid="grid"], [data-testid="crash"]'); await sleep(300)
    after = { crash: await crash(), ids: (await ws(page))?.projects.map((p) => p.id), backups: await backups() }
  }
  out.B = { crashAfterImport: c1, crashAfterReload: c2, btns, after, dialogs: errors.filter((e) => e.type === 'dialog').slice(-2).map((e) => e.text.slice(0, 120)) }
  console.log('B', JSON.stringify(out.B).slice(0, 1500))
}

if (!process.env.ONLY || process.env.ONLY.includes('C'))
// ---- C. 壊れた画面の「退避したデータに戻す」が、いちばん新しい退避＝同じ壊れたデータを選んでしまう場合（保存データ自体に外す行＋描画で落ちる項目）
{
  await fresh(page)
  const base = await baseWs()
  await importJson(JSON.stringify(mkWs(base, 'P-GOOD')))
  const bad = mkWs(base, 'P-BAD2'); bad.suppliers[0] = null; bad.projects[0].rows.push({ name: 'id の無い行' })
  await page.evaluate(([k, s]) => localStorage.setItem(k, s), [LS_KEY, JSON.stringify(bad)])
  await page.reload(); await page.waitForSelector('[data-testid="grid"], [data-testid="crash"]'); await sleep(150)
  const steps = []
  for (let i = 0; i < 3; i++) {
    const c = await crash()
    const b = await backups()
    steps.push({ crash: c, newest: b[0] && { reason: b[0].reason, ids: b[0].ids }, all: b.map((x) => x.reason + ':' + JSON.stringify(x.ids)) })
    if (!c) break
    await page.locator('[data-testid="crash"] button', { hasText: '退避したデータに戻す' }).click()
    await page.waitForSelector('[data-testid="grid"], [data-testid="crash"]'); await sleep(300)
  }
  out.C = { steps }
  console.log('C', JSON.stringify(out.C).slice(0, 2500))
}

if (!process.env.ONLY || process.env.ONLY.includes('D'))
// ---- D. 容量ぎりぎり: 埋め草で localStorage をほぼ満杯にしてから JSON 読み込み
{
  await fresh(page)
  const base = await baseWs()
  // 上限を測る
  const cap = await page.evaluate(() => { const k = '__cap'; let lo = 0, hi = 20_000_000; while (lo < hi) { const mid = Math.floor((lo + hi + 1) / 2); try { localStorage.setItem(k, 'x'.repeat(mid)); lo = mid } catch { hi = mid - 1 } } localStorage.removeItem(k); return lo })
  const used0 = await lsUsage()
  // いまのワークスペースを大きくして、退避（同じ大きさ）が入らない程度に埋める
  const big = mkWs(base, 'P-BIG', 1500)
  await importJson(JSON.stringify(big))
  const used1 = await lsUsage()
  const wsLen = (await page.evaluate((k) => localStorage.getItem(k).length, LS_KEY))
  const filler = cap - used1 - Math.floor(wsLen / 2)
  await page.evaluate((n) => { try { localStorage.setItem('__filler', 'y'.repeat(n)) } catch (e) { return String(e) } }, Math.max(0, filler))
  const used2 = await lsUsage()
  const b0 = await backups()
  // 読み込む（小さい JSON）
  const r1 = await importJson(JSON.stringify(mkWs(base, 'P-NEW')), ['yes', 'no']) // 最初の確認で「置き換える」→ 次の「退避せずに…」で既定（やめる）
  const ids1 = (await ws(page)).projects.map((p) => p.id)
  const b1 = await backups()
  const r2 = await importJson(JSON.stringify(mkWs(base, 'P-NEW')), ['yes', 'yes'])
  const ids2 = (await ws(page)).projects.map((p) => p.id)
  out.D = { cap, used0, used1, wsLen, filler, used2, backupsBefore: b0, firstAttempt: r1, idsAfterCancel: ids1, backupsAfter: b1, secondAttempt: r2, idsAfterForce: ids2, backupsAfterForce: await backups() }
  console.log('D', JSON.stringify(out.D).slice(0, 2500))
}
if (!process.env.ONLY || process.env.ONLY.includes('E'))
// ---- E. 容量ぎりぎりで、読めなかったデータの退避（守るはずのもの）が押し出されるか
{
  await fresh(page)
  const base = await baseWs()
  const cap = await page.evaluate(() => { const k = '__cap'; let lo = 0, hi = 20_000_000; while (lo < hi) { const mid = Math.floor((lo + hi + 1) / 2); try { localStorage.setItem(k, 'x'.repeat(mid)); lo = mid } catch { hi = mid - 1 } } localStorage.removeItem(k); return lo })
  // 大きな本番データ P-REAL（約 cap の 30%）が読めなくなった
  const real = mkWs(base, 'P-REAL', 0)
  let extra = 0; let raw = JSON.stringify(real)
  while (raw.length < cap * 0.3) { extra += 300; raw = JSON.stringify(mkWs(base, 'P-REAL', extra)) }
  const broken = raw.slice(0, -300)
  await page.evaluate(([k, s]) => { localStorage.clear(); localStorage.setItem(k, s) }, [LS_KEY, broken])
  await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await sleep(200)
  const b0 = await backups()
  // サンプルで作業 → 大きめの JSON を 2 回読み込む（いまの内容の退避が要る）
  const mid = JSON.stringify(mkWs(base, 'P-MID', Math.floor(extra * 0.9)))
  const r1 = await importJson(mid)
  const b1 = await backups()
  const r2 = await importJson(JSON.stringify(mkWs(base, 'P-MID2', Math.floor(extra * 0.9))))
  const b2 = await backups()
  out.E = { cap, brokenLen: broken.length, backupsAfterLoad: b0, import1: r1, backupsAfterImport1: b1, import2: r2, backupsAfterImport2: b2, ls: await lsUsage() }
  console.log('E', JSON.stringify(out.E).slice(0, 3000))
}
save('23-backup.json', out)
dumpErrors(errors, '23')
await browser.close()
