import { state } from './lib.mjs'
export async function stateSafe(page) {
  let ws = await state(page)
  if (!ws) { await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+s'); ws = await state(page) }
  return ws
}
export async function showCol(page, label) {
  await page.keyboard.press('c')
  const cols = await page.locator('[data-testid="columns"] .opt').allTextContents()
  const i = cols.findIndex((c) => c.includes(label))
  const hidden = cols[i]?.startsWith('○')
  if (i >= 0 && hidden) { for (let k = 0; k < i; k++) await page.keyboard.press('ArrowDown'); await page.keyboard.press('Space') }
  await page.keyboard.press('Escape')
  return i >= 0
}
