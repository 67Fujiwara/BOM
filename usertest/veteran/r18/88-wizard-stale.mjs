// ラウンド14: ガイドで隠した列のある .xlsx を読んだあと、貼り付け（1）に切り替えて別の表を貼ると、プレビューに前のファイルの注意が残るか
import path from 'node:path'
import { launch, fresh, palette, sleep, toastNow, ws } from '../r8/rerun7/rerun6/lib.mjs'
import { saveJson } from './lib18.mjs'
const DL = '/home/user/BOM/usertest/veteran/r18/dl'
const TAG = process.env.TAG ?? ''
const { browser, page, errors } = await launch()
const out = []
const toStep7 = async (id) => { await palette(page, '新しいBOM'); await sleep(60); await page.getByTestId('wizard-id').fill(id); await page.keyboard.press('Enter'); for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await sleep(20) } }
const prev = async () => ((await page.getByTestId('wizard-preview').textContent({ timeout: 3000 }).catch(() => '')) ?? '').slice(0, 700)
const loadFile = async (f) => { await page.keyboard.press('2'); await sleep(60); await page.getByTestId('wizard-file').setInputFiles(path.join(DL, f)); for (let i = 0; i < 100; i++) { if (/読み込みました|読めません/.test(await toastNow(page))) break; await sleep(100) } }
for (const k of [1, 2]) {
  // S1: ファイル（隠した列あり）→ 1 に切り替え → 欄を別の表に置き換え → Ctrl+Enter
  await fresh(page); await toStep7('P-ST' + k)
  await loadFile('m3-oldnew-hidden-old-repeat.xlsx')
  const t1 = await toastNow(page)
  await page.keyboard.press('1'); await sleep(100)
  await page.getByTestId('wizard-paste').fill('部品名\t型式\t数量\nヒューズ\tF-10\t4\n電源\tS8\t1'); await sleep(80)
  await page.getByTestId('wizard-paste').focus(); await page.keyboard.press('Control+Enter'); await sleep(300)
  const p1 = await prev()
  await page.keyboard.press('Enter'); await page.waitForFunction(() => !document.querySelector('[data-testid="panel-wizard"]'), null, { timeout: 30000 }).catch(() => {})
  const w = await ws(page); const pr = w.projects.find((x) => x.id === w.currentProjectId)
  out.push({ run: k, case: 'S1 隠した列の .xlsx → 1 → 別の表を貼る → プレビュー', toastFile: t1.slice(0, 300), preview: p1, created: pr.rows.map((r) => `${r.name}/${r.model}/${r.qtyNeeded}`) })
  // S2: ファイル（隠した列あり）→ 隠した列の無い別の .xlsx を選び直す
  await fresh(page); await toStep7('P-SU' + k)
  await loadFile('m3-oldnew-hidden-old-repeat.xlsx')
  await loadFile('a1-nashi-fumon.xlsx')
  const t2 = await toastNow(page)
  await page.keyboard.press('Enter'); await sleep(300)
  out.push({ run: k, case: 'S2 隠した列の .xlsx → 隠した列の無い .xlsx を選び直す → プレビュー', toast: t2.slice(0, 300), preview: await prev() })
  console.log(JSON.stringify(out.slice(-2)).slice(0, 2500))
}
out.push({ errors: errors.filter((e) => e.type !== 'dialog').slice(0, 10) })
saveJson(`88-wizard-stale${TAG}.json`, out)
await browser.close()
