// N2-05〜N2-14, U2-01〜U2-12 の再検証
import { launch, fresh, T, makeLog, shot, sel, gotoCol, store, row, proj, ui, palette, runPalette, setRole, clearToast } from './lib.mjs'
const { browser, context, page, errors } = await launch()
const { log, save } = makeLog('t05_reverify')
const step = async (name, fn) => { try { await fn() } catch (e) { log('EXC', name, String(e).slice(0, 300)) } }
const openWizard = async () => { await palette(page, '新しいBOM'); await page.keyboard.press('Enter'); await page.getByTestId('wizard').waitFor() }
const stepTitle = async () => (await page.getByTestId('wizard').locator('h3').textContent().catch(() => '(closed)'))

// N2-05 型式あいまいを部品名列から起票 → 設計が型式を直して公開
await step('N2-05', async () => {
  await fresh(page, 'purchasing'); await page.keyboard.press('1')
  await sel(page, 'R020'); await gotoCol(page, '部品名')
  await page.keyboard.press('Shift+I'); await page.keyboard.press('k'); await page.keyboard.type('型式に定格電圧がありません'); await page.keyboard.press('Enter')
  const iss = (await proj(page)).issues.filter((i) => i.rowId === 'R020').map((i) => `${i.id}:${i.field}:${i.kind}:${i.status}`)
  log('N2-05 raised (purchasing from 部品名 col):', iss)
  await page.keyboard.press('Control+Enter'); await page.waitForTimeout(100)
  log('  publish panel', await T.panelText(page)); if (await T.panel(page)) { await page.keyboard.press('Enter'); await page.waitForTimeout(100) }
  log('  toast', await T.toast(page))
  await setRole(page, 'design'); await sel(page, 'R020'); await gotoCol(page, '型式')
  await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('S-T21 AC200V 1a'); await page.keyboard.press('Enter')
  await page.keyboard.press('Control+Enter'); await page.waitForTimeout(100)
  for (let i = 0; i < 3 && (await T.panel(page)); i++) { log('  design publish panel', await T.panelText(page)); await page.keyboard.press(i === 0 ? 'Enter' : '1'); await page.waitForTimeout(100); if (await T.panel(page)) { await page.keyboard.press('Enter'); await page.waitForTimeout(100) } }
  log('  after design publish', await T.toast(page), (await proj(page)).issues.filter((i) => i.rowId === 'R020').map((i) => `${i.id}:${i.field}:${i.kind}:${i.status}`))
  // メーカ未記入・数量見直しも部品名列から
  await setRole(page, 'purchasing'); await page.keyboard.press('1'); await sel(page, 'R021'); await gotoCol(page, '部品名')
  await page.keyboard.press('Shift+I'); await page.keyboard.press('m'); await page.keyboard.type('メーカ不明'); await page.keyboard.press('Enter')
  await sel(page, 'R022'); await gotoCol(page, '部品名')
  await page.keyboard.press('Shift+I'); await page.keyboard.press('r'); await page.keyboard.type('減らせますか'); await page.keyboard.press('Enter')
  log('  m / r fields:', (await proj(page)).issues.filter((i) => ['R021', 'R022'].includes(i.rowId)).map((i) => `${i.rowId}:${i.field}:${i.kind}`))
})

// N2-06 ? をキーでスクロール（1024x700）
await step('N2-06', async () => {
  await page.setViewportSize({ width: 1024, height: 700 })
  await fresh(page); await page.keyboard.press('?')
  const st = () => page.evaluate(() => { const b = document.querySelector('.overlay .dialog .body'); return b ? { st: Math.round(b.scrollTop), sh: b.scrollHeight, ch: b.clientHeight } : null })
  const s0 = await st()
  await page.keyboard.press('ArrowDown'); const s1 = await st()
  await page.keyboard.press('PageDown'); const s2 = await st()
  await page.keyboard.press('End'); const s3 = await st()
  await page.keyboard.press('Home'); const s4 = await st()
  await page.keyboard.press('Space'); const s5 = await st()
  log('N2-06 help scroll', JSON.stringify({ s0, s1, s2, s3, s4, s5 }))
  await page.keyboard.type('採用'); log('  typing in help -> panel', await T.panel(page), 'scroll', JSON.stringify(await st()))
  await shot(page, 't05_help_1024')
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 1440, height: 900 })
})

// N2-07 案件設定の納期に過去日
await step('N2-07', async () => {
  await fresh(page, 'pm')
  for (const v of ['2025-01-01', '2026-10-01', '来月', '2026-12-25']) {
    await runPalette(page, '案件設定'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter')
    await page.getByTestId('settings-input').fill(v); await page.keyboard.press('Enter')
    log(`N2-07 settings due "${v}":`, await T.toast(page), '| err', await page.locator('[data-testid=settings] .err-text').textContent().catch(() => null))
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.keyboard.press('Escape')
  }
  log('  header due', await page.getByTestId('due').textContent())
})

// N2-08 購買がガイドで作る
await step('N2-08', async () => {
  await fresh(page, 'purchasing'); await openWizard()
  await page.getByTestId('wizard-id').fill('PUR-1'); for (let i = 0; i < 7; i++) await page.keyboard.press('Enter')
  log('N2-08 step', await stepTitle()); await page.keyboard.press('3'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter')
  await page.waitForTimeout(100)
  const p = await proj(page)
  log('  created', p.id, 'members', JSON.stringify(p.members), 'toast', await T.toast(page), 'view', (await ui(page)).view)
  await page.keyboard.press('Shift+Enter'); log('  Shift+Enter', await T.toast(page))
})

// N2-09 / N-30 詳細の相見積表（1280x720, 800x600, 1440）
for (const vp of [[1440, 900], [1280, 720], [1024, 700], [800, 600]]) await step('N2-09', async () => {
  await page.setViewportSize({ width: vp[0], height: vp[1] })
  await fresh(page); await page.keyboard.press('1'); await sel(page, 'R022'); await page.keyboard.press(' ')
  await page.waitForTimeout(100)
  const info = await page.evaluate(() => { const t = document.querySelector('table.quotes'); if (!t) return null; const tds = [...t.querySelectorAll('tbody tr')].map((tr) => ({ h: Math.round(tr.getBoundingClientRect().height), txt: tr.innerText.replace(/\s+/g, ' ').slice(0, 80) })); const td = t.querySelector('tbody td:nth-child(2)'); const cs = td ? getComputedStyle(td) : null; const d = document.querySelector('[data-testid=detail]').getBoundingClientRect(); return { rows: tds, pad: cs?.paddingLeft, ws: cs?.whiteSpace, detailTop: Math.round(d.top), detailBottom: Math.round(d.bottom), vh: innerHeight, scrollW: document.documentElement.scrollWidth, vw: innerWidth } })
  log(`N2-09 ${vp.join('x')}`, JSON.stringify(info))
  await shot(page, `t05_detail_${vp.join('x')}`)
})
await page.setViewportSize({ width: 1440, height: 900 })

// N2-10 / U2-07 未回答の商社・順位の並び
await step('N2-10', async () => {
  await fresh(page); await page.keyboard.press('1'); await sel(page, 'R030'); await page.keyboard.press(' ')
  log('N2-10 R030 quotes', (await page.locator('table.quotes tbody').innerText()).replace(/\s+/g, ' ').slice(0, 300))
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter'); await page.waitForTimeout(80)
  log('  Enter on 3rd quote ->', await T.panelText(page), '| toast', await T.toast(page))
  await page.keyboard.press('Escape')
  await sel(page, 'R020'); await page.keyboard.press(' ')
  log('U2-07 R020 order', (await page.locator('table.quotes tbody').innerText()).replace(/\s+/g, ' ').slice(0, 300))
})

// N2-11 / U2-09 ガイドの外クリック・リロード
await step('N2-11', async () => {
  await fresh(page); await openWizard()
  await page.getByTestId('wizard-id').fill('CLICKOUT')
  await page.mouse.click(5, 5); await page.waitForTimeout(100)
  log('N2-11 after outside click panel', await T.panel(page), 'toast', await T.toast(page))
  await openWizard(); log('  reopen id', await page.getByTestId('wizard-id').inputValue().catch(() => '-'), 'step', await stepTitle())
  await page.getByTestId('wizard-id').fill('RELOAD-1'); await page.keyboard.press('Enter'); await page.getByTestId('wizard-name').fill('リロード案件')
  await page.reload(); await page.getByTestId('grid').waitFor(); await page.waitForTimeout(200)
  log('U2-09 after reload panel', await T.panel(page), 'toast', await T.toast(page))
  if (!(await T.panel(page))) await openWizard()
  log('  wizard after reload step', await stepTitle(), 'name', await page.getByTestId('wizard-name').inputValue().catch(() => '-'))
  await page.keyboard.press('Escape')
})

// N2-12 / U2-03 1024 のステータスバー・ランプ
await step('N2-12', async () => {
  await page.setViewportSize({ width: 1024, height: 700 })
  await fresh(page); await page.keyboard.press('1'); await sel(page, 'R022')
  const sb = await page.evaluate(() => { const s = document.querySelector('[data-testid=status]'); const r = s.getBoundingClientRect(); return { h: Math.round(r.height), kids: [...s.children].map((c) => Math.round(c.getBoundingClientRect().height)), sw: s.scrollWidth, cw: s.clientWidth } })
  const lamps = await page.evaluate(() => [...document.querySelectorAll('[data-testid=lamps] .lamp')].map((l) => `${l.textContent}:${getComputedStyle(l).display}`))
  log('N2-12 status 1024', JSON.stringify(sb), 'lamps', lamps.join(' / '), 'header', (await T.header(page)).replace(/\s+/g, ' '))
  await shot(page, 't05_1024_grid')
  await page.setViewportSize({ width: 1440, height: 900 })
})

// N2-14 / N-28 / U-07 貼り付け
await step('N2-14', async () => {
  const pastes = {
    headerEn: 'Part\tModel\tMaker\tQty\nRelay\tMY4N\tOmron\t4',
    noHeader4: 'リレー\tMY4N\tオムロン\t4\nタイマ\tH3CR-A8\tオムロン\t2',
    noHeader3: 'リレー\tMY4N\t4\nタイマ\tH3CR-A8\t2',
    noHeader2: 'MY4N\t4\nH3CR-A8\t2',
    oneCol: 'MY4N\nH3CR-A8',
    excel: '品名\t形式\tメーカー\t員数\t備考\nリレー\tMY4N-D2 DC24\tオムロン\t12\t予備込み',
    qtyFirst: '数量\t品名\t型式\n4\tリレー\tMY4N',
  }
  for (const [k, txt] of Object.entries(pastes)) {
    await fresh(page); await openWizard()
    for (let i = 0; i < 7; i++) await page.keyboard.press('Enter')
    await page.keyboard.press('1'); await page.waitForTimeout(50)
    await page.getByTestId('wizard-paste').fill(txt)
    await page.keyboard.press('Control+Enter'); await page.waitForTimeout(50)
    const pv = (await page.getByTestId('wizard-preview').innerText().catch(() => '-')).replace(/\s+/g, ' ')
    await page.keyboard.press('Enter'); await page.waitForTimeout(100)
    const p = await proj(page)
    log(`paste[${k}] preview: ${pv.slice(0, 330)}`)
    log(`   rows: ${p.rows.slice(0, 2).map((r) => `{cat:${r.category},name:${r.name},model:${r.model},maker:${r.maker},qty:${r.qtyNeeded}}`).join(' ')} toast=${await T.toast(page)}`)
  }
})

// U2-01 役割プロンプトで数字
await step('U2-01', async () => {
  await fresh(page)
  await runPalette(page, '役割')
  log('U2-01 role prompt', await T.panelText(page))
  await page.keyboard.press('3'); await page.waitForTimeout(80)
  log('  after 3: panel', await T.panelText(page))
  if (await T.panel(page)) { await page.keyboard.press('Enter'); await page.waitForTimeout(80) }
  const u = await ui(page); log('  role', u.role, 'user', u.user, 'toast', await T.toast(page))
})

// U2-02 パネルの中で Ctrl+K
await step('U2-02', async () => {
  await fresh(page); await page.keyboard.press('1'); await sel(page, 'R030')
  await page.keyboard.press('Shift+I'); await page.keyboard.press('Control+k'); log('U2-02 Ctrl+K in issue panel ->', await T.panel(page))
  await page.keyboard.press('Escape')
  await openWizard(); await page.getByTestId('wizard-id').fill('CK-1'); await page.keyboard.press('Control+k'); log('  Ctrl+K in wizard ->', await T.panel(page))
  await page.keyboard.press('Escape'); await openWizard(); log('  wizard resumed id', await page.getByTestId('wizard-id').inputValue().catch(() => '-'))
  await page.keyboard.press('Escape')
})

// U2-04 作成直後のカーソル
await step('U2-04', async () => {
  await fresh(page); await openWizard()
  for (let i = 0; i < 7; i++) await page.keyboard.press('Enter')
  await page.keyboard.press('3'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await page.waitForTimeout(100)
  const u = await ui(page); log('U2-04 after create cursor', u.cursorRow, u.cursorCol, 'view', u.view, 'toast', await T.toast(page))
  await page.keyboard.press('Enter'); await page.keyboard.type('リレー'); await page.keyboard.press('Enter')
  const r = (await proj(page)).rows[0]; log('  typed リレー -> name', r.name, 'model', r.model)
  await page.keyboard.press('n'); const u2 = await ui(page); log('  n ->', u2.cursorRow, u2.cursorCol)
})

// U2-05 変更セットの理由
await step('U2-05', async () => {
  await fresh(page); await page.keyboard.press('1'); await sel(page, 'R030'); await gotoCol(page, '部品名')
  await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('リレー改'); await page.keyboard.press('Enter')
  await page.keyboard.press('Control+Enter'); await page.waitForTimeout(80)
  log('U2-05 publish panel1', await T.panelText(page))
  await page.keyboard.press('Enter'); await page.waitForTimeout(80); log('  Enter ->', await T.panelText(page), '| toast', await T.toast(page))
  await page.keyboard.press('Enter'); await page.waitForTimeout(80); log('  Enter ->', await T.panelText(page), '| toast', await T.toast(page))
})

// U2-06 隠した行と 4
await step('U2-06', async () => {
  await fresh(page); await page.keyboard.press('4')
  const n0 = (await ui(page)); const c0 = await page.getByTestId('view-4').innerText()
  await page.keyboard.press('ArrowDown'); const id = (await ui(page)).cursorRow
  await page.keyboard.press('h'); await page.waitForTimeout(80)
  log('U2-06 hide', id, 'toast', await T.toast(page), 'view4 count', c0.replace(/\s+/g, ' '), '->', (await page.getByTestId('view-4').innerText()).replace(/\s+/g, ' '), 'row in DOM', await page.locator(`[data-row-id="${id}"]`).count())
  await palette(page, '隠した'); log('  palette 隠した', (await page.getByTestId('palette-list').innerText()).replace(/\s+/g, ' ').slice(0, 120)); await page.keyboard.press('Escape')
})

// U2-08 JSON 読み込みのファイル選択
await step('U2-08', async () => {
  await fresh(page); await runPalette(page, 'JSON を読み込む')
  log('U2-08 import panel', await T.panelText(page), 'file input', await page.getByTestId('import-file').count())
  await page.keyboard.press('Escape')
})

// U2-10 案件設定 Esc
await step('U2-10', async () => {
  await fresh(page, 'pm'); await runPalette(page, '案件設定'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter')
  await page.getByTestId('settings-input').fill('12'); await page.keyboard.press('Enter')
  await page.keyboard.press('Escape'); log('U2-10 Esc1 panel', await T.panel(page), 'toast', await T.toast(page))
  await page.keyboard.press('Escape'); log('  Esc2 panel', await T.panel(page), 'toast', await T.toast(page))
})

// U2-11 編集中のリロード
await step('U2-11', async () => {
  await fresh(page); await page.keyboard.press('1'); await sel(page, 'R030'); await gotoCol(page, '部品名')
  await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('RELOADVAL')
  let dlg = null; page.once('dialog', async (d) => { dlg = d.type() + ':' + d.message(); await d.accept() })
  await page.reload(); await page.getByTestId('grid').waitFor(); await page.waitForTimeout(150)
  const r = await row(page, 'R030'); log('U2-11 after reload R030', r.name, JSON.stringify(r.working), 'dialog', dlg)
  // 読めない値（必要数に abc）で
  await sel(page, 'R031'); await gotoCol(page, '必要数'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('abc')
  dlg = null; page.once('dialog', async (d) => { dlg = d.type() + ':' + d.message(); await d.dismiss() })
  await page.reload().catch(() => {}); await page.waitForTimeout(400)
  log('  invalid value reload dialog', dlg, 'mode', (await ui(page).catch(() => ({}))).mode)
})

// U2-12 Ctrl+G
await step('U2-12', async () => {
  await fresh(page); await page.keyboard.press('1')
  for (const q of ['r30', 'R30', '30', 'KA1', 'ka1', 'FX5U', 'ブザー', 'TB', '表76', 'E-2026-041-04']) {
    await page.keyboard.press('Control+g'); await page.getByTestId('prompt-text').fill(q); await page.keyboard.press('Enter'); await page.waitForTimeout(60)
    log(`U2-12 Ctrl+G "${q}" ->`, (await ui(page)).cursorRow, '| toast', await T.toast(page), '| panel', await T.panel(page))
    if (await T.panel(page)) await page.keyboard.press('Escape')
  }
})
save(errors)
await browser.close()
