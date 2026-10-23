// R03: N-03/04/08/09/25/29/30/33/34/37, U-04/05/08/14/17/22 の再確認
import { launch, fresh, T, makeLog, shot, sel, gotoCol, store, clearToast, palette, runPalette, setRole, attachErrors } from './lib.mjs'
const { log, save } = makeLog('r03_layout_mouse')
const allErrors = []
const measure = async (page, tag) => {
  const m = await page.evaluate(() => {
    const vw = window.innerWidth
    const header = document.querySelector('.header')
    const vis = (sel) => { const el = document.querySelector(sel); if (!el) return 'none'; const r = el.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom), inView: r.left >= 0 && r.right <= vw && r.width > 0 } }
    const status = document.querySelector('.status')
    return { vw, headerScroll: header.scrollWidth, headerClient: header.clientWidth, headerH: Math.round(header.getBoundingClientRect().height), headerScrollLeft: header.scrollLeft, pid: vis('.header .pid'), due: vis('[data-testid=due]'), roleD: vis('[data-testid=role-design]'), roleP: vis('[data-testid=role-pm]'), pal: vis('[data-testid=open-palette]'), help: vis('[data-testid=open-help]'), lamps: vis('[data-testid=lamps]'), statusScroll: status.scrollWidth, statusClient: status.clientWidth, docW: document.documentElement.scrollWidth, docH: document.documentElement.scrollHeight, vh: window.innerHeight, dialog: vis('.dialog'), detail: vis('[data-testid=detail]'), toast: vis('[data-testid=toast-float]') }
  })
  log(tag, JSON.stringify(m))
  return m
}
for (const [w, h, scheme] of [[1024, 700, 'light'], [1280, 720, 'light'], [1024, 700, 'dark'], [800, 600, 'light'], [1366, 768, 'dark']]) {
  const { browser, page, errors } = await launch({ viewport: { width: w, height: h }, colorScheme: scheme })
  const tag = `${w}x${h}-${scheme}`
  try {
    await fresh(page)
    await measure(page, tag + ' grid')
    await shot(page, `r03_${tag}_grid`)
    // N-04: 役割ボタンをクリック
    await page.getByTestId('role-purchasing').click()
    await measure(page, tag + ' after role click')
    await page.getByTestId('role-design').click()
    await page.getByTestId('open-palette').click()
    log(tag, 'palette by click:', await T.panel(page)); await page.keyboard.press('Escape')
    await page.getByTestId('open-help').click()
    await measure(page, tag + ' help'); await shot(page, `r03_${tag}_help`)
    await page.keyboard.press('Escape')
    // N-29 下の行で Space
    await page.locator('.gridwrap').focus()
    await sel(page, 'R022'); await page.keyboard.press('Space')
    const dm = await measure(page, tag + ' detail')
    await shot(page, `r03_${tag}_detail`)
    // N-30 商社名
    const sup = await page.evaluate(() => [...document.querySelectorAll('[data-testid=detail] table.quotes tr')].slice(0, 4).map((tr) => Math.round(tr.getBoundingClientRect().height)))
    log(tag, 'N-30 quote row heights', JSON.stringify(sup))
    // 詳細を開いたまま下の行へ
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown')
    const cur = await page.evaluate(() => { const td = document.querySelector('td.cursor'); const d = document.querySelector('[data-testid=detail]'); if (!td) return null; const a = td.getBoundingClientRect(); const b = d?.getBoundingClientRect(); return { tdT: Math.round(a.top), tdB: Math.round(a.bottom), detT: b ? Math.round(b.top) : null, detB: b ? Math.round(b.bottom) : null, vh: innerHeight } })
    log(tag, 'cursor vs detail after ↓3', JSON.stringify(cur))
    await shot(page, `r03_${tag}_detail_down`)
    await page.keyboard.press('Space')
    // 案件設定・ガイド
    await runPalette(page, '案件設定'); await measure(page, tag + ' settings'); await shot(page, `r03_${tag}_settings`); await page.keyboard.press('Escape')
    await runPalette(page, '新しいBOM', '新しいBOM'); for (let i = 0; i < 7; i++) await page.keyboard.press('Enter'); await page.keyboard.press('1')
    await measure(page, tag + ' wizard7'); await shot(page, `r03_${tag}_wizard7`); await page.keyboard.press('Escape')
    // トースト長文
    await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+Enter')
    await measure(page, tag + ' toast'); await shot(page, `r03_${tag}_toast`)
    await page.keyboard.press('Escape')
    // 右端列
    await sel(page, 'R005'); await page.keyboard.press('End')
    const vis = await page.evaluate(() => { const td = document.querySelector('td.cursor'); const g = document.querySelector('.gridwrap'); if (!td) return null; const a = td.getBoundingClientRect(), b = g.getBoundingClientRect(); return { tdL: Math.round(a.left), tdR: Math.round(a.right), gL: Math.round(b.left), gR: Math.round(b.right) } })
    log(tag, 'End col visible', JSON.stringify(vis))
    // sticky ID 列の重なり
    await page.keyboard.press('Home')
    // 9 ビュー購買
    await setRole(page, 'purchasing'); await shot(page, `r03_${tag}_purch`)
    await setRole(page, 'pm'); await shot(page, `r03_${tag}_pm`)
    await measure(page, tag + ' pm')
  } catch (e) { log('EXC', tag, String(e).slice(0, 300)) }
  allErrors.push(...errors.map((e) => ({ ...e, at: tag })))
  await browser.close()
}
// マウス中心
{
  const { browser, page, errors } = await launch()
  try {
    await fresh(page)
    // N-25 編集中に別セルをクリック
    const nameCell = page.locator('[data-row-id="R030"] td.name')
    await nameCell.dblclick()
    log('N-25 dblclick name: mode', await T.mode(page))
    await page.keyboard.type('X')
    await page.locator('[data-row-id="R035"] td.name').click()
    log('N-25 click other cell during edit: mode', await T.mode(page), 'cursor', await T.cursor(page), 'R030 name', await T.cell(page, 'R030', 'name'), 'toast', await T.toast(page))
    await page.keyboard.type('abc')
    log('N-25 typed abc: mode', await T.mode(page), 'editor', await page.getByTestId('cell-editor').inputValue().catch(() => '-'))
    await page.keyboard.press('Enter')
    log('N-25 Enter: R035', await T.cell(page, 'R035', 'name'), 'R030', await T.cell(page, 'R030', 'name'), 'mode', await T.mode(page))
    await shot(page, 'r03_edit_click_other')
    // 編集中に役割ボタン
    await fresh(page)
    await page.locator('[data-row-id="R031"] td.model').dblclick(); await page.keyboard.press('Control+a'); await page.keyboard.type('ROLE-TEST')
    await page.getByTestId('role-purchasing').click()
    log('N-25 role click during edit: mode', await T.mode(page), 'role', await T.role(page), 'toast', await T.toast(page))
    await page.keyboard.press('Enter')
    log('  Enter -> toast', await T.toast(page), 'R031 store', (await store(page)).projects[0].rows.find((r) => r.id === 'R031').working?.model ?? '-')
    // 編集中にビューをクリック
    await fresh(page)
    await page.locator('[data-row-id="R032"] td.name').dblclick(); await page.keyboard.press('Control+a'); await page.keyboard.type('VIEWCLICK')
    await page.getByTestId('view-4').click()
    log('N-25 view click during edit: mode', await T.mode(page), 'view', await T.view(page), 'toast', await T.toast(page), 'R032 store', (await store(page)).projects[0].rows.find((r) => r.id === 'R032').working?.name ?? '-')
    // 編集中に Ctrl+K ボタン
    await fresh(page)
    await page.locator('[data-row-id="R033"] td.name').dblclick(); await page.keyboard.press('Control+a'); await page.keyboard.type('PALCLICK')
    await page.getByTestId('open-palette').click()
    log('N-25 palette click during edit: panel', await T.panel(page), 'mode', await T.mode(page), 'R033', (await store(page)).projects[0].rows.find((r) => r.id === 'R033').working?.name ?? '-')
    await page.keyboard.press('Escape')
    // 編集中に表の外（ヘッダー余白）をクリック
    await fresh(page)
    await page.locator('[data-row-id="R034"] td.name').dblclick(); await page.keyboard.press('Control+a'); await page.keyboard.type('OUTCLICK')
    await page.getByTestId('lamps').click()
    log('click outside during edit: mode', await T.mode(page), 'active', await page.evaluate(() => document.activeElement?.tagName + '.' + document.activeElement?.className), 'R034', (await store(page)).projects[0].rows.find((r) => r.id === 'R034').working?.name ?? '-')
    await page.keyboard.type('zz'); await page.keyboard.press('Enter')
    log('  typed zz Enter: mode', await T.mode(page), 'R034', (await store(page)).projects[0].rows.find((r) => r.id === 'R034').working?.name ?? '-', 'toast', await T.toast(page))
    // N-33 ダブルクリック権限外
    await fresh(page, 'purchasing'); await page.keyboard.press('1')
    await page.locator('[data-row-id="R030"] td.model').dblclick()
    log('N-33 purchasing dblclick model: mode', await T.mode(page), 'toast', await T.toast(page))
    await page.keyboard.press('Escape')
    await page.locator('[data-row-id="R030"] td[data-col="amount"]').dblclick().catch(() => {})
    log('N-33 dblclick amount: mode', await T.mode(page), 'toast', await T.toast(page))
    await page.keyboard.press('Escape')
    // N-34 役割クリック後の Space/Enter
    await fresh(page)
    await sel(page, 'R020'); await page.getByTestId('role-purchasing').click(); await clearToast(page)
    await page.keyboard.press('Space'); await page.waitForTimeout(50)
    log('N-34 Space after role click: toast', await T.toast(page), 'detail', await page.getByTestId('detail').count(), 'active', await page.evaluate(() => document.activeElement?.tagName + '.' + document.activeElement?.className))
    // U-04 マウスで押せそうなもの
    await fresh(page)
    const th = page.locator('th', { hasText: '部品名' }).first()
    await th.click()
    log('U-04 click th 部品名: sort chip', await page.locator('.toolbar .chip').allTextContents(), 'cursor', await T.cursor(page))
    await page.locator('[data-row-id="R005"] td.name').click(); await page.keyboard.press('f')
    log('U-04 f on name: chips', await page.locator('.toolbar .chip').allTextContents(), 'rows', await T.rows(page))
    await page.locator('.toolbar .chip').first().click()
    log('U-04 click chip: chips', await page.locator('.toolbar .chip').allTextContents(), 'rows', await T.rows(page))
    const hint = page.locator('.status .hints span').first()
    log('U-04 status hints:', await T.hints(page))
    await hint.click(); log('U-04 click first hint: mode', await T.mode(page), 'panel', await T.panel(page))
    await page.keyboard.press('Escape')
    // 詳細の指摘をクリック
    await sel(page, 'R016'); await page.keyboard.press('Space')
    const iss = page.getByTestId('issues').locator('.issue, li, tr').first()
    await iss.click().catch((e) => log('click issue err', String(e).slice(0, 80)))
    log('U-04 click issue: mode', await T.mode(page), 'panel', await T.panel(page), 'sel', await page.getByTestId('issues').locator('[aria-selected="true"]').count())
    await page.keyboard.press('Enter'); log('  then Enter: panel', await T.panelText(page), 'mode', await T.mode(page))
    await page.keyboard.press('Escape')
    // U-22 見積行を ↓ で
    await sel(page, 'R020'); await page.keyboard.press('Space')
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown')
    log('U-22 detail ↓3: focus quote', await page.locator('[data-testid=detail] [aria-selected="true"], [data-testid=detail] .focus').count(), 'cursor', await T.cursor(page))
    await shot(page, 'r03_detail_quote_focus')
    await page.keyboard.press('Enter'); log('U-22 Enter on quote row: panel', await T.panelText(page), 'toast', await T.toast(page))
    await page.keyboard.press('Escape')
    // U-08 役割の既定ビュー
    await fresh(page)
    log('U-08 design initial view', await T.view(page))
    await setRole(page, 'purchasing'); log('U-08 purchasing view', await T.view(page))
    await setRole(page, 'pm'); log('U-08 pm view', await T.view(page))
    // N-08 未公開の値
    await fresh(page); await page.keyboard.press('1')
    await sel(page, 'R030'); await gotoCol(page, '型式'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('NEW-MODEL'); await page.keyboard.press('Enter')
    await setRole(page, 'purchasing'); await page.keyboard.press('1')
    log('N-08 purchasing sees R030 model', await T.cell(page, 'R030', 'model'), 'row', await T.rowText(page, 'R030'))
    await shot(page, 'r03_working_as_purchasing')
    await sel(page, 'R030'); await page.keyboard.press(' ')
    log('N-08 purchasing detail', (await page.getByTestId('detail').innerText().catch(() => '-')).replace(/\s+/g, ' ').slice(0, 300))
    await setRole(page, 'pm'); await page.keyboard.press('1')
    log('N-08 pm sees R030 model', await T.cell(page, 'R030', 'model'))
    // U-14 リロード後 Ctrl+Z
    await setRole(page, 'design')
    await page.reload(); await page.getByTestId('grid').waitFor(); await page.locator('.gridwrap').focus()
    log('U-14 after reload: role', await T.role(page), 'view', await T.view(page), 'cursor', await T.cursor(page))
    await page.keyboard.press('Control+z'); log('U-14 Ctrl+Z after reload:', await T.toast(page)); await page.keyboard.press('1')
    log('  R030', await T.cell(page, 'R030', 'model'))
    // N-37 favicon
    log('N-37 favicon', await page.evaluate(() => document.querySelector('link[rel*=icon]')?.getAttribute('href')))
  } catch (e) { log('EXC mouse', String(e).slice(0, 300)) }
  allErrors.push(...errors.map((e) => ({ ...e, at: 'mouse' })))
  await browser.close()
}
// N-09 2 タブ
{
  const { browser, context, page, errors } = await launch()
  try {
    await fresh(page); await page.keyboard.press('1')
    const page2 = await context.newPage(); attachErrors(page2, errors, 'tab2')
    await page2.goto('http://localhost:5173/'); await page2.getByTestId('grid').waitFor(); await page2.locator('.gridwrap').focus(); await page2.keyboard.press('1')
    log('N-09 tab2 role', await T.role(page2), 'tab1 role', await T.role(page))
    await sel(page2, 'R031'); await gotoCol(page2, '部品名'); await page2.keyboard.press('Enter'); await page2.keyboard.press('Control+a'); await page2.keyboard.type('タブ2'); await page2.keyboard.press('Enter')
    await page.bringToFront()
    await sel(page, 'R032'); await gotoCol(page, '部品名'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('タブ1'); await page.keyboard.press('Enter')
    const p = (await store(page)).projects[0]
    log('N-09 stored R031', p.rows.find((r) => r.id === 'R031').working?.name ?? '(none)', 'R032', p.rows.find((r) => r.id === 'R032').working?.name ?? '(none)')
    log('N-09 tab1 shows R031', await T.cell(page, 'R031', 'name'), 'tab2 shows R032', await T.cell(page2, 'R032', 'name'))
    await page2.reload(); await page2.getByTestId('grid').waitFor(); await page2.keyboard.press('1').catch(() => {})
    await page2.locator('.gridwrap').focus(); await page2.keyboard.press('1')
    log('N-09 tab2 after reload R031', await T.cell(page2, 'R031', 'name'), 'R032', await T.cell(page2, 'R032', 'name'))
    // 同じセルを両方で
    await sel(page, 'R040'); await gotoCol(page, '部品名'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('A案')
    await page2.bringToFront(); await page2.locator('.gridwrap').focus()
    await sel(page2, 'R040'); await gotoCol(page2, '部品名'); await page2.keyboard.press('Enter'); await page2.keyboard.press('Control+a'); await page2.keyboard.type('B案'); await page2.keyboard.press('Enter')
    await page.bringToFront(); await page.keyboard.press('Enter')
    await page.waitForTimeout(100)
    log('same cell: stored', (await store(page)).projects[0].rows.find((r) => r.id === 'R040').working?.name, 'tab1', await T.cell(page, 'R040', 'name'), 'tab2', await T.cell(page2, 'R040', 'name'), 'toast1', await T.toast(page))
    // tab2 で Ctrl+Z → tab1 の変更？
    await page2.bringToFront(); await page2.locator('.gridwrap').focus(); await page2.keyboard.press('Control+z')
    log('tab2 Ctrl+Z: toast', await T.toast(page2), 'R040 tab2', await T.cell(page2, 'R040', 'name'), 'stored', (await store(page2)).projects[0].rows.find((r) => r.id === 'R040').working?.name ?? '(none)')
    // 役割はタブごと
    await setRole(page2, 'purchasing')
    await page.bringToFront(); await page.reload(); await page.getByTestId('grid').waitFor()
    log('tab1 role after tab2 changed to purchasing:', await T.role(page), 'tab2', await T.role(page2))
    // tab2 購買で起票中に tab1 で編集
    await page2.close()
  } catch (e) { log('EXC tabs', String(e).slice(0, 300)) }
  allErrors.push(...errors.map((e) => ({ ...e, at: 'tabs' })))
  await browser.close()
}
save(allErrors)
