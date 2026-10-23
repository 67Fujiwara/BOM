// R15: 1440 幅の見積表・ステータスバー折り返し・パレット完全一致の誤実行
import { launch, fresh, T, makeLog, shot, sel, store, clearToast, palette, paletteTop } from './lib.mjs'
const { log, save } = makeLog('r15_extra')
const all = []
for (const vp of [{ width: 1440, height: 900 }, { width: 1024, height: 700 }]) {
  const { browser, page, errors } = await launch({ viewport: vp })
  try {
    await fresh(page); await page.keyboard.press('1')
    await sel(page, 'R016'); await page.keyboard.press(' ')
    const q = await page.evaluate(() => [...document.querySelectorAll('[data-testid=detail] table.quotes tbody tr')].map((tr) => ({ h: Math.round(tr.getBoundingClientRect().height), cells: [...tr.children].slice(0, 3).map((td) => td.innerText.replace(/\s+/g, ' ')), pad: getComputedStyle(tr.children[1]).paddingLeft, ws: getComputedStyle(tr.children[0]).whiteSpace })))
    log(vp.width, 'R016 quote rows', JSON.stringify(q))
    await shot(page, `r15_${vp.width}_detail_R016`)
    const sb = await page.evaluate(() => { const s = document.querySelector('.status'); const r = s.getBoundingClientRect(); return { h: Math.round(r.height), sh: s.scrollHeight, ch: s.clientHeight, bottom: Math.round(r.bottom), vh: innerHeight, kids: [...s.children].map((c) => Math.round(c.getBoundingClientRect().height)) } })
    log(vp.width, 'status bar', JSON.stringify(sb))
    // パレット: ラベルどおり打って Enter
    await page.keyboard.press('Escape')
    const before = (await store(page))?.projects[0].submissions?.length ?? 1
    await palette(page, 'JSON を書き出す'); log(vp.width, 'top', (await paletteTop(page, 1))[0])
    const dl = page.waitForEvent('download', { timeout: 2000 }).catch(() => null)
    await page.keyboard.press('Enter'); log(vp.width, 'Enter ->', await T.panelText(page))
    await page.keyboard.press('Enter'); await page.waitForTimeout(150)
    log(vp.width, 'Enter Enter -> toast', await T.toast(page), 'download', (await dl)?.suggestedFilename() ?? 'none', 'submissions', before, '->', (await store(page))?.projects[0].submissions.length, 'rev-info', await page.getByTestId('rev-info').textContent().catch(() => '-'))
    await shot(page, `r15_${vp.width}_json_export_published`)
  } catch (e) { log('EXC', String(e).slice(0, 300)) }
  all.push(...errors)
  await browser.close()
}
save(all)
