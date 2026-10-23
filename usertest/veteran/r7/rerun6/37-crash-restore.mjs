// ラウンド5: 画面が壊れる型違い（ルールの正規表現・末尾の提出）での「退避したデータに戻す」（V4-07 の再確認）
// A) JSON 読み込みで壊れた → 戻す。B) 保存データ自体が壊れている（他タブ・手修正）→ リロード → 戻す（3 回押す）
import { launch, fresh, sleep, dumpErrors, save, palette, panel, toastNow, ws, LS_KEY } from './lib.mjs'
const { browser, page, errors } = await launch({ acceptDialogs: true })
const out = {}
const BK = 'bom-pro.workspace.backup'
const crash = async () => page.getByTestId('crash').count()
const backups = () => page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k) ?? '[]').map((b) => `${b.reason}:${(() => { try { return JSON.parse(b.raw).currentProjectId } catch { return '?' } })()}`) } catch { return ['(unreadable)'] } }, BK)
const cur = () => page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k)).currentProjectId } catch { return '?' } }, LS_KEY)
async function importJson(text) {
  await palette(page, 'JSON を読み込む'); await sleep(40)
  await page.evaluate((t) => { const el = document.querySelector('[data-testid="import-text"]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, t); el.dispatchEvent(new Event('input', { bubbles: true })) }, text)
  await page.getByTestId('import-text').focus(); await page.keyboard.press('Control+Enter'); await sleep(80)
  if (await panel(page)) { await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await sleep(150) }
}
const badRule = { id: 'bad', name: 'bad', field: 'model', type: 'regex', pattern: '(', severity: 'warn', message: 'x', owner: 'x', scope: 'all', enabled: true }
// A
{
  await fresh(page); await page.keyboard.press('Control+s')
  const w = await ws(page); w.projects[0].id = 'P-BAD'; w.currentProjectId = 'P-BAD'; w.rules = [...w.rules, badRule]
  await importJson(JSON.stringify(w))
  const c1 = await crash()
  const steps = []
  for (let i = 0; i < 2; i++) {
    const btn = page.locator('[data-testid="crash"] button', { hasText: '退避したデータに戻す' })
    if (!(await btn.count())) { steps.push({ i, note: 'no restore button', crash: await crash() }); break }
    await btn.click(); await page.waitForSelector('[data-testid="grid"], [data-testid="crash"]'); await sleep(300)
    steps.push({ i, crash: await crash(), cur: await cur(), backups: await backups(), toast: (await crash()) ? '' : await toastNow(page) })
    if (!(await crash())) break
  }
  out.A = { crashAfterImport: c1, steps }
  console.log('A', JSON.stringify(out.A))
}
// B: 保存データに直接（JSON 読み込みを通らない）
{
  await fresh(page); await page.keyboard.press('Control+s')
  // 先に良い JSON を 1 回読み込んで「JSON 読み込みの前」の退避を作っておく
  const good = await ws(page); good.projects[0].id = 'P-GOOD'; good.currentProjectId = 'P-GOOD'
  await importJson(JSON.stringify(good))
  const w = await ws(page); w.rules = [...w.rules, badRule]
  await page.evaluate(([k, s]) => localStorage.setItem(k, s), [LS_KEY, JSON.stringify(w)])
  await page.reload(); await page.waitForSelector('[data-testid="grid"], [data-testid="crash"]'); await sleep(200)
  const c0 = await crash()
  const b0 = await backups()
  const steps = []
  for (let i = 0; i < 3; i++) {
    const btn = page.locator('[data-testid="crash"] button', { hasText: '退避したデータに戻す' })
    if (!(await btn.count())) { steps.push({ i, note: 'no restore button', crash: await crash() }); break }
    await btn.click(); await page.waitForSelector('[data-testid="grid"], [data-testid="crash"]'); await sleep(300)
    steps.push({ i, crash: await crash(), cur: await cur(), backups: await backups() })
    if (!(await crash())) break
  }
  out.B = { crashOnLoad: c0, backupsAtCrash: b0, steps }
  console.log('B', JSON.stringify(out.B))
}
dumpErrors(errors, '37')
save('37-crash-restore.json', out)
await browser.close()
