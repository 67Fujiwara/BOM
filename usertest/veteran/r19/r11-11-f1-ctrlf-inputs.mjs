// ラウンド10: すべての入力欄で F1 / Ctrl+F（既定動作を止めるか・キーの一覧が開くか・入れた文字が残るか）
import { open, reset, sleep, logger, state, gotoCell, installPrevLog, takePrevLog } from './lib19.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`11-f1-ctrlf-inputs-${port}.json`)
const panel = () => pg.evaluate(() => document.querySelector('[data-testid^="panel-"]')?.dataset.testid ?? null)
const active = () => pg.evaluate(() => { const a = document.activeElement; return `${a?.tagName}.${a?.className ?? ''}[${a && 'value' in a ? a.value : ''}]` })
async function pal(q) { await pg.keyboard.press('Control+k'); await pg.getByTestId('palette-input').fill(q); await sleep(80); await pg.keyboard.press('Enter'); await sleep(150) }
const CTX = {
  'パレット': async () => { await pg.keyboard.press('Control+k'); await pg.keyboard.type('abc') },
  'Ctrl+G の欄': async () => { await pg.keyboard.press('Control+g'); await pg.keyboard.type('R01') },
  '採用理由の補足': async () => { await gotoCell(pg, 1, 'R004', 'ID'); await pg.keyboard.press('Shift+A'); await sleep(80); await pg.keyboard.press('2'); await sleep(80); await pg.keyboard.press('1'); await pg.keyboard.type('memo') },
  '指摘の起票（Alt+Shift+I）': async () => { await gotoCell(pg, 1, 'R010', '部品名'); await pg.keyboard.press('Alt+Shift+I'); await sleep(120); await pg.keyboard.type('memo') },
  'JSON を読み込むの欄': async () => { await pal('JSON を読み込む'); await pg.getByTestId('import-text').focus(); await pg.keyboard.type('{"a":') },
  '新しいBOM の貼り付け欄': async () => { await pal('新しいBOM'); await pg.getByTestId('wizard-id').fill('P-Z'); await pg.keyboard.press('Enter'); for (let i = 0; i < 6; i++) { await pg.keyboard.press('Enter'); await sleep(20) } await pg.keyboard.press('1'); await sleep(80); await pg.keyboard.type('abc') },
  '案件設定の欄': async () => { await pal('案件設定'); await sleep(100); await pg.keyboard.press('Enter'); await sleep(80); await pg.keyboard.type('9') },
  '絞り込み欄': async () => { await pg.keyboard.press('Control+f'); await pg.keyboard.type('ab') },
  'セルの編集中': async () => { await gotoCell(pg, 1, 'R010', '備考'); await pg.keyboard.type('memo') },
}
for (const [name, prep] of Object.entries(CTX)) for (const k of ['F1', 'Control+f']) {
  await reset(env); await prep(); await sleep(80); await installPrevLog(pg); await takePrevLog(pg)
  const before = { panel: await panel(), active: await active() }
  await pg.keyboard.press(k); await sleep(150)
  const pv = (await takePrevLog(pg)).filter((x) => x.key === (k === 'F1' ? 'F1' : 'f'))
  log({ name, k, before, after: { panel: await panel(), active: await active(), mode: (await state(pg)).mode }, prevented: pv.map((x) => x.prevented) })
  for (let i = 0; i < 4; i++) await pg.keyboard.press('Escape')
}
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
