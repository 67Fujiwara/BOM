// N2-03 / N2-04 再検証 + 編集中のいろいろなクリック
import { launch, fresh, T, makeLog, shot, sel, gotoCol, store, row, diff, ui } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t02_mouse_edit')
const nameOf = async (id) => { const r = await row(page, id); return r ? (r.working?.name ?? r.name) : null }
async function snapshot() { const ws = await store(page); return ws.projects.find((x) => x.id === ws.currentProjectId).rows }
async function changed(before) { const after = await snapshot(); const out = []; for (const r of after) { const o = before.find((x) => x.id === r.id); if (!o) out.push('NEW ' + r.id); else if (JSON.stringify(o) !== JSON.stringify(r)) out.push(`${r.id}: ${diff(o, r)}`) } return out.join(' | ') || '-' }
async function startTyping(id, text) {
  await sel(page, id)
  await page.locator(`[data-row-id="${id}"] td.name`).dblclick()
  await page.keyboard.press('Control+a'); await page.keyboard.type(text)
}
const cases = [
  ['view-4 click', async () => page.getByTestId('view-4').click()],
  ['view-7 click', async () => page.getByTestId('view-7').click()],
  ['palette button', async () => page.getByTestId('open-palette').click()],
  ['help button', async () => page.getByTestId('open-help').click()],
  ['side 新しいBOM', async () => page.locator('.side .clickable', { hasText: '新しいBOM' }).click()],
  ['side Ctrl+P', async () => page.locator('.side .clickable', { hasText: '受信箱' }).click()],
  ['role purchasing', async () => page.getByTestId('role-purchasing').click()],
  ['column header click', async () => page.locator('table.grid thead th').nth(3).click()],
  ['group row click', async () => page.getByTestId('group-row').first().click()],
  ['status hint Esc', async () => page.locator('.status .hints .clickable', { hasText: '取り消し' }).click()],
  ['filter box click+type', async () => { await page.locator('input.filter').click(); await page.keyboard.type('zz') }],
  ['wheel scroll far', async () => { await page.locator('.gridwrap').hover(); await page.mouse.wheel(0, 3000); await page.waitForTimeout(200) }],
]
for (const [label, act] of cases) {
  try {
    await fresh(page); await page.keyboard.press('1')
    const before = await snapshot()
    await startTyping('R032', 'EDIT_' + label.replace(/\W/g, ''))
    await act()
    await page.waitForTimeout(150)
    const u = await ui(page)
    const toast = await T.toast(page)
    const panel = await T.panel(page)
    log(`[${label}] after click: mode=${u.mode} view=${u.view} cursor=${u.cursorRow}/${u.cursorCol} editValue=${JSON.stringify(u.editValue)} panel=${panel} toast=${toast}`)
    await shot(page, `t02_${label.replace(/\W/g, '_')}`)
    if (panel) await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    log(`   changed: ${await changed(before)}`)
  } catch (e) { log('EXC', label, String(e).slice(0, 300)) }
}
save(errors)
await browser.close()
