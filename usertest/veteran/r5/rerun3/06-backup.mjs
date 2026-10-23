// 退避・復元の流れ: 退避が 1 つしかないことで元データを失う順序 / 画面が壊れたときの復旧 / 容量
import fs from 'node:fs'
import path from 'node:path'
import { launch, fresh, setRole, goto, toCol, sleep, dumpErrors, save, panel, closeAll, palette, toastNow, ws, shot, DL, LS_KEY } from './lib.mjs'
const { browser, page, errors } = await launch()
page.removeAllListeners('dialog')
let acceptDialogs = false
page.on('dialog', async (d) => { errors.push({ type: 'dialog', text: d.message().slice(0, 100) }); if (acceptDialogs) await d.accept(); else await d.dismiss() })
const out = {}
const log = (k, o) => { out[k] = o; console.log(k, JSON.stringify(o).slice(0, 1500)) }
const backup = () => page.evaluate(() => { const b = JSON.parse(localStorage.getItem('bom-pro.workspace.backup') ?? 'null'); return b ? { reason: b.reason, len: b.raw.length, head: b.raw.slice(0, 60) } : null })
async function importJson(text) {
  await palette(page, 'JSON を読み込む'); await sleep(40)
  await page.evaluate((t) => { const el = document.querySelector('[data-testid="import-text"]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, t); el.dispatchEvent(new Event('input', { bubbles: true })) }, text)
  await page.getByTestId('import-text').focus()
  await page.keyboard.press('Control+Enter'); await sleep(60)
  if (await panel(page)) { await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await sleep(100) }
  return (await toastNow(page)).slice(0, 200)
}
// A: 保存データが壊れている → サンプル表示（退避あり）→ 利用者が手元の古い JSON を読み込む → 退避が上書きされ、壊れた元データ（手で直せたはず）が消える
{
  await fresh(page)
  await page.keyboard.press('Control+s')
  const w = await ws(page)
  w.projects[0].id = 'P-REAL'; w.projects[0].name = '本番の案件（最新）'
  const good = JSON.stringify(w)
  const broken = good.slice(0, good.length - 40) // 途中で切れた（書き込み中のクラッシュ等）
  await page.evaluate(([k, s]) => localStorage.setItem(k, s), [LS_KEY, broken])
  await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await sleep(150)
  const t1 = await toastNow(page)
  const b1 = await backup()
  await page.locator('.gridwrap').focus()
  // 手元の古い JSON（別の案件）を読み込む
  const t2 = await importJson(JSON.stringify({ projects: [{ id: 'P-OLD', name: '先月書き出した JSON', rows: [{ id: 'R001', name: '古い' }] }] }))
  const b2 = await backup()
  log('A: one-slot backup overwritten', { toastOnLoad: t1.slice(0, 160), backupAfterLoad: b1, importToast: t2.slice(0, 120), backupAfterImport: b2, brokenOriginalStillSomewhere: await page.evaluate((len) => Object.keys(localStorage).some((k) => (localStorage.getItem(k) ?? '').length >= len - 100 && (localStorage.getItem(k) ?? '').includes('P-REAL')), broken.length) })
  // 「読み込み前に戻す」で戻るのは？
  await palette(page, '読み込み前に戻す'); await sleep(40)
  const conf = (await page.locator('[data-testid^="panel-"]').first().innerText().catch(() => '')).slice(0, 160)
  await closeAll(page)
  out['A: one-slot backup overwritten'].restoreOffers = conf
}
// A2: サンプルデータに戻す（パレット）は退避を残すか
{
  await fresh(page)
  await page.keyboard.press('Control+s')
  const w = await ws(page); w.projects[0].id = 'P-REAL2'
  await page.evaluate(([k, s]) => localStorage.setItem(k, s.slice(0, -10)), [LS_KEY, JSON.stringify(w)])
  await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await sleep(100); await page.locator('.gridwrap').focus()
  const b1 = await backup()
  await palette(page, 'サンプルデータに戻す'); await sleep(40); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await sleep(80)
  log('A2: reset keeps backup', { before: b1, after: await backup() })
}
// B: 型の違う JSON で画面が壊れる → リロードでも壊れる → 壊れた画面から戻る道
{
  await fresh(page)
  await goto(page, 'R030'); await toCol(page, '部品名'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('壊れる前の値'); await page.keyboard.press('Enter')
  await importJson(JSON.stringify({ projects: [{ id: 'T', rows: [{ id: 'R001', name: 'a', category: { x: 1 } }] }] }))
  const c1 = await page.getByTestId('crash').count()
  await page.reload(); await page.waitForSelector('[data-testid="grid"], [data-testid="crash"]'); await sleep(100)
  const c2 = await page.getByTestId('crash').count()
  // 壊れた画面でキーボード: Ctrl+K は効くか / Tab でボタンに行けるか
  await page.keyboard.press('Control+k'); await sleep(50)
  const paletteOnCrash = await panel(page)
  await page.keyboard.press('Tab'); const focus1 = await page.evaluate(() => document.activeElement?.textContent)
  await shot(page, '06-crash-screen')
  acceptDialogs = true
  await page.locator('[data-testid="crash"] button', { hasText: 'サンプルに戻す' }).click(); await sleep(300)
  await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus()
  const b = await backup()
  const t = await toastNow(page)
  await palette(page, '読み込み前に戻す'); await sleep(40); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await sleep(100)
  const w = await ws(page)
  const r030 = w?.projects.find((p) => p.id === 'P-2026-041')?.rows.find((r) => r.id === 'R030')
  acceptDialogs = false
  log('B: crash recovery path', { crashAfterImport: c1, crashAfterReload: c2, paletteOnCrashScreen: paletteOnCrash, tabFocus: focus1, backupAfterReset: b, toastAfterReset: t.slice(0, 100), restoredR030: r030?.working?.name ?? r030?.name, ids: w?.projects.map((p) => p.id) })
}
// C: 容量: 大きいワークスペース（約 2.6MB）を JSON で読み込む → 退避（同じくらい）＋本体で 5MB を超えると保存できない
{
  await fresh(page)
  await page.keyboard.press('Control+s')
  const w = await ws(page)
  const big = structuredClone(w)
  const p0 = big.projects[0]
  big.projects = []
  for (let i = 0; i < 10; i++) { const p = structuredClone(p0); p.id = 'P-BIG-' + i; p.name = '大きい案件 ' + i; big.projects.push(p) }
  const bigText = JSON.stringify(big)
  // まず大きいワークスペースを作る（直接）
  await page.evaluate(([k, s]) => localStorage.setItem(k, s), [LS_KEY, bigText])
  await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus()
  // 同じくらいの JSON を読み込む（別の名前）
  const big2 = structuredClone(big); big2.projects.forEach((p) => (p.name += '（新）'))
  const t = await importJson(JSON.stringify(big2))
  const lsSizes = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k).length])))
  // 1 回編集 → 保存できるか
  await goto(page, 'R030'); await toCol(page, '部品名'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('容量テスト'); await page.keyboard.press('Enter'); await sleep(80)
  const t2 = await toastNow(page)
  const saved = await page.evaluate((k) => (localStorage.getItem(k) ?? '').includes('容量テスト'), LS_KEY)
  await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await sleep(100)
  const afterReload = await page.evaluate((k) => { const w = JSON.parse(localStorage.getItem(k) ?? 'null'); return { names: w?.projects.slice(0, 2).map((p) => p.name), hasEdit: JSON.stringify(w).includes('容量テスト') } }, LS_KEY)
  log('C: quota', { bigBytes: bigText.length, importToast: t.slice(0, 160), lsSizes, editToast: t2.slice(0, 120), editSaved: saved, afterReload })
}
save('06-backup.json', out)
dumpErrors(errors, '06')
await browser.close()
