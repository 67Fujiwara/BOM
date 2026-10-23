// R02: キー操作系の再確認 N-05, N-11, N-12, N-14, N-15, N-16, N-17, N-20, N-21, N-22, N-26, N-27, N-31, N-32, N-35, N-36, N-38
import { launch, fresh, T, makeLog, shot, sel, gotoCol, store, clearToast, palette, runPalette, setRole } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('r02_keys')
const st = async (id) => (await page.locator(`[data-row-id="${id}"] .status-pill`).first().textContent().catch(() => '-'))
try {
  await fresh(page)
  const statuses = await page.evaluate(() => [...document.querySelectorAll('[data-row-id]')].map((tr) => tr.dataset.rowId + ':' + (tr.querySelector('.status-pill')?.textContent ?? '')))
  log('statuses:', statuses.join(' '))
  // N-05 行未選択
  for (const k of ['a', 'Shift+I', 'x', 'r', 'o', 'i', 'h', 'Shift+A', 'Alt+a', 'w', 'Control+.', 'Shift+R', 'Shift+X', 'y', 'Shift+Y', 'Shift+Delete', 'Delete', 'Shift+D', 'Space', 'Enter', 'f', 's']) {
    await fresh(page)
    const before = await store(page)
    await page.keyboard.press(k)
    await page.waitForTimeout(30)
    const after = await store(page)
    const changed = JSON.stringify(before?.projects?.[0]?.rows) !== JSON.stringify(after?.projects?.[0]?.rows)
    log(`N-05 no-cursor ${k}: cursor`, await T.cursor(page), 'panel', await T.panel(page), 'toast', await T.toast(page), 'mode', await T.mode(page), 'rowsChanged', changed)
    await page.keyboard.press('Escape')
  }
  // Esc 連打後
  await fresh(page); await sel(page, 'R010'); for (let i = 0; i < 4; i++) await page.keyboard.press('Escape')
  log('after Esc x4 cursor', await T.cursor(page))
  await page.keyboard.press('a'); log('N-05 a after Esc spam:', await T.toast(page), 'R010', await st('R010'), 'R001', await st('R001'))
  // N-32 a on draft row
  await fresh(page)
  const pick = (s) => statuses.find((x) => x.endsWith(':' + s))?.split(':')[0]
  for (const s of ['下書き', '提出済', '見積中', '選定済', '発注済', '取消']) {
    const id = pick(s); if (!id) { log('no row with', s); continue }
    await sel(page, id); await clearToast(page); await page.keyboard.press('a')
    log(`N-32 a on ${s} ${id}:`, await T.toast(page))
  }
  // N-26 Backspace
  await fresh(page); await sel(page, 'R011'); await gotoCol(page, '型式')
  const m0 = await T.cell(page, 'R011', 'model')
  await page.keyboard.press('Backspace'); await page.waitForTimeout(30)
  log('N-26 Backspace: model', m0, '->', await T.cell(page, 'R011', 'model'), 'toast', await T.toast(page), 'mode', await T.mode(page))
  await page.keyboard.press('Escape')
  await clearToast(page)
  await page.keyboard.press('Delete'); await page.waitForTimeout(30)
  log('N-26 Delete: model ->', await T.cell(page, 'R011', 'model'), 'toast', await T.toast(page))
  await page.keyboard.press('Escape'); await page.keyboard.press('Control+z')
  log('  ctrl+z ->', await T.cell(page, 'R011', 'model'), await T.toast(page))
  // N-27 Shift+Delete / h / r
  await fresh(page); await sel(page, 'R011'); await page.keyboard.press('Shift+Delete')
  log('N-27 Shift+Delete R011: panel', await T.panelText(page), 'toast', await T.toast(page), 'status', await st('R011'))
  await page.keyboard.press('Escape')
  await sel(page, 'R077'); await page.keyboard.press('h')
  log('N-27 h R077: toast', await T.toast(page), 'panel', await T.panel(page))
  await page.keyboard.press('Escape'); await clearToast(page)
  await sel(page, 'R003'); await page.keyboard.press('r')
  log('N-27 r R003: panel', await T.panelText(page), 'toast', await T.toast(page), 'mode', await T.mode(page), 'rows', await T.rows(page))
  await shot(page, 'r02_r_replace')
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape')
  // N-20 必要数 全角
  for (const v of ['１０', '10個', '十', '0', '-1', '1.5', '1,000', '１２']) {
    await fresh(page); await sel(page, 'R077'); await gotoCol(page, '必要数')
    await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type(v); await page.keyboard.press('Enter')
    await page.waitForTimeout(30)
    log(`N-20 qty "${v}": cell`, await T.cell(page, 'R077', 'num').catch(() => '?'), 'mode', await T.mode(page), 'editErr', await page.getByTestId('edit-error').textContent().catch(() => null), 'toast', await T.toast(page))
    await page.keyboard.press('Escape')
  }
  // 数値セルで数字（U-02）
  await fresh(page); await sel(page, 'R004'); await gotoCol(page, '必要数')
  await page.keyboard.press('5')
  log('U-02 press 5 on qty: view', await T.view(page), 'cursor', await T.cursor(page), 'toast', await T.toast(page), 'mode', await T.mode(page))
  // N-21 0 件で Enter
  await fresh(page)
  await page.keyboard.press('/'); await page.keyboard.type('zzzz'); await page.keyboard.press('Enter')
  log('N-21 filter zzzz Enter: toast', await T.toast(page), 'cursor', await T.cursor(page), 'rows', await T.rows(page))
  await page.keyboard.press('Enter'); log('N-21 Enter again: mode', await T.mode(page), 'toast', await T.toast(page))
  await page.keyboard.press('Shift+Enter'); log('N-21 Shift+Enter: mode', await T.mode(page), 'toast', await T.toast(page), 'rows', await T.rows(page))
  await page.keyboard.press('Escape')
  // N-22 filter 中の Ctrl+K / ? / Ctrl+Z
  await fresh(page)
  await page.keyboard.press('/'); await page.keyboard.press('Control+k'); log('N-22 / then Ctrl+K: panel', await T.panel(page)); await page.keyboard.press('Escape')
  await page.keyboard.press('/'); await page.keyboard.press('?'); log('N-22 / then ?: panel', await T.panel(page), 'filter', await page.getByTestId('filter').inputValue())
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape')
  await page.keyboard.press('/'); await page.keyboard.type('リレー'); await page.keyboard.press('Control+z')
  log('N-22 Ctrl+Z in filter: filter', await page.getByTestId('filter').inputValue(), 'toast', await T.toast(page))
  await page.keyboard.press('Escape')
  // U-10 / 2 回
  await page.keyboard.press('/'); await page.keyboard.press('/')
  log('U-10 // filter', JSON.stringify(await page.getByTestId('filter').inputValue()), 'rows', await T.rows(page))
  await page.keyboard.press('Escape')
  // N-38 Ctrl+G 空
  await fresh(page); await page.keyboard.press('Control+g'); await page.keyboard.press('Enter')
  log('N-38 Ctrl+G empty Enter: cursor', await T.cursor(page), 'toast', await T.toast(page), 'panel', await T.panel(page))
  await page.keyboard.press('Escape')
  // U-09 Ctrl+G 部品名 / 全角
  for (const q of ['リレー', 'ＦＸ５Ｕ', 'fx5u', '30', 'r30', 'KA1']) {
    await page.keyboard.press('Control+g'); await page.getByTestId('prompt-text').fill(q); await page.keyboard.press('Enter')
    log(`U-09 Ctrl+G "${q}": cursor`, await T.cursor(page), 'toast', await T.toast(page), 'panel', await T.panel(page))
    await page.keyboard.press('Escape')
  }
  await page.keyboard.press('/'); await page.keyboard.type('ＦＸ５Ｕ'); log('U-09 filter ＦＸ５Ｕ rows', await T.rows(page)); await page.keyboard.press('Escape')
  // N-11 公開ゲート順序
  await fresh(page); await sel(page, 'R010'); await page.keyboard.press('Shift+Enter'); await page.keyboard.type('新しい部品'); await page.keyboard.press('Enter'); await page.keyboard.press('Escape')
  await page.keyboard.press('Control+Enter')
  log('N-11 Ctrl+Enter with error row: panel', await T.panelText(page), 'toast', await T.toast(page))
  await shot(page, 'r02_publish_gate')
  await page.keyboard.press('Escape')
  // N-12 公開後の Ctrl+Z
  await fresh(page); await sel(page, 'R030'); await gotoCol(page, '型式'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('M22N-XYZ'); await page.keyboard.press('Enter')
  const revBefore = await page.getByTestId('rev-info').textContent().catch(() => '-')
  await page.keyboard.press('Control+Enter')
  log('N-12 publish prompt:', await T.panelText(page))
  for (let i = 0; i < 3 && (await T.panel(page)); i++) { log('  prompt', await T.panelText(page)); await page.keyboard.press('Enter'); await page.waitForTimeout(80) }
  log('N-12 after publish toast', await T.toast(page), 'rev', revBefore, '->', await page.getByTestId('rev-info').textContent().catch(() => '-'), 'role-status', await page.getByTestId('role-status').textContent())
  await clearToast(page)
  await page.keyboard.press('Control+z')
  log('N-12 Ctrl+Z after publish: toast', await T.toast(page), 'rev', await page.getByTestId('rev-info').textContent().catch(() => '-'), 'R030', await T.cell(page, 'R030', 'model'), 'role-status', await page.getByTestId('role-status').textContent())
  await shot(page, 'r02_undo_after_publish')
  // N-31 設計の Shift+I
  await fresh(page); await sel(page, 'R020'); await page.keyboard.press('Shift+I')
  log('N-31 design Shift+I panel', await T.panelText(page))
  await page.keyboard.press('k'); log('N-31 design k: toast', await T.toast(page), 'text?', await page.getByTestId('issue-text').count())
  await page.keyboard.press('q'); log('N-31 design q: text?', await page.getByTestId('issue-text').count())
  await page.keyboard.press('Escape')
  // 購買 N-14, N-15, U-11, U-12
  await fresh(page, 'purchasing'); await page.keyboard.press('1'); await sel(page, 'R040')
  await page.keyboard.press('Shift+I'); log('U-11 kinds panel', await T.panelText(page))
  for (const k of ['z', 'Enter']) { await page.keyboard.press(k); log(`U-11 kinds ${k}: text?`, await page.getByTestId('issue-text').count(), 'toast', await T.toast(page)) }
  await page.keyboard.press('Escape')
  await page.keyboard.press('Shift+I'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter')
  log('U-11 ↓↓Enter: panel', await T.panelText(page))
  await page.keyboard.press('Escape')
  await page.keyboard.press('Shift+I'); await page.keyboard.press('3'); log('U-11 digit 3:', await T.panelText(page)); await page.keyboard.press('Escape')
  await page.keyboard.press('Shift+I'); await page.keyboard.press('k'); await page.keyboard.press('Enter')
  log('N-14 empty body Enter: panel', await T.panel(page), 'toast', await T.toast(page))
  await page.keyboard.press('Escape')
  // U-12 本文入力後 J
  await page.keyboard.press('Shift+I'); await page.keyboard.press('m'); await page.getByTestId('issue-text').fill('メーカを書いてください'); await page.keyboard.press('Shift+J')
  log('U-12 Shift+J with text: panel', await T.panel(page), 'text', await page.getByTestId('issue-text').inputValue().catch(() => '-'), 'cursor', await T.cursor(page))
  await page.keyboard.press('Escape')
  // field で起票（cursor は部品名）
  await sel(page, 'R020'); await gotoCol(page, '部品名'); await page.keyboard.press('Shift+I'); await page.keyboard.press('k'); await page.getByTestId('issue-text').fill('型式があいまい'); await page.keyboard.press('Enter')
  const ws = await store(page); const iss = ws.projects[0].issues.at(-1)
  log('N-14b kind k from 部品名 col -> field', iss.field, iss.kind, 'toast', await T.toast(page))
  // N-15 提案欄 Tab
  await sel(page, 'R022'); await page.keyboard.press('Shift+I'); await page.keyboard.press('d'); await page.getByTestId('issue-text').fill('廃番です')
  await page.keyboard.press('Tab'); log('N-15 Tab1 active', await page.evaluate(() => document.activeElement?.getAttribute('data-testid')))
  await page.keyboard.type('NEW-123'); await page.keyboard.press('Tab'); log('N-15 Tab2 active', await page.evaluate(() => document.activeElement?.getAttribute('data-testid')))
  await page.keyboard.type('オムロン'); await page.keyboard.press('Tab'); await page.keyboard.type('S01'); await page.keyboard.press('Tab'); await page.keyboard.type('１２００円'); await page.keyboard.press('Tab'); await page.keyboard.type('3週間')
  log('N-15 proposal fields', await page.locator('[data-testid^="proposal-"]').evaluateAll((els) => els.map((e) => e.dataset.testid + '=' + e.value)))
  await shot(page, 'r02_proposal')
  await page.keyboard.press('Enter'); log('N-15 Enter: toast', await T.toast(page), 'panel', await T.panel(page))
  await page.keyboard.press('Escape')
  const ws2 = await store(page); log('  last issue', JSON.stringify(ws2.projects[0].issues.at(-1)?.proposal))
  // N-17 下書きが設計に見える？
  await setRole(page, 'design'); await page.keyboard.press('1'); await sel(page, 'R040'); await page.keyboard.press(' ')
  log('N-17 design sees R040 issues:', (await page.getByTestId('issues').innerText().catch(() => '-')).replace(/\s+/g, ' ').slice(0, 300))
  await sel(page, 'R020'); await page.keyboard.press(' ')
  log('N-17 design sees R020 issues:', (await page.getByTestId('issues').innerText().catch(() => '-')).replace(/\s+/g, ' ').slice(0, 300))
  // N-16 PM y on non-decision row
  await fresh(page, 'pm'); await page.keyboard.press('1'); await sel(page, 'R020'); await page.keyboard.press('y')
  log('N-16 PM y on R020: panel', await T.panel(page), 'toast', await T.toast(page))
  await page.keyboard.press('Escape')
  log('U-20 PM hints on R020:', await T.hints(page))
  // N-36 Ctrl+. 候補なし Enter
  await fresh(page); await sel(page, 'R002'); await page.keyboard.press('Control+.')
  log('N-36 Ctrl+. clean row: panel', await T.panelText(page))
  await page.keyboard.press('Enter'); log('N-36 Enter: panel', await T.panel(page))
  await page.keyboard.press('Escape')
  // N-35 CapsLock 相当（e.key 小文字＋Shift）
  await fresh(page); await sel(page, 'R002'); await clearToast(page)
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', code: 'KeyC', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true })))
  log('N-35 Ctrl+Shift+c: toast', await T.toast(page), 'panel', await T.panel(page))
  await clearToast(page)
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', code: 'KeyF', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true })))
  log('N-35 Ctrl+Shift+f: toast', await T.toast(page), 'panel', await T.panel(page))
} catch (e) { log('EXC', String(e).slice(0, 500)) }
save(errors)
await browser.close()
