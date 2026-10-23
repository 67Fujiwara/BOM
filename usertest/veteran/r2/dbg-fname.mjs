import { launch, URL } from './lib.mjs'
const { browser, page } = await launch()
await page.goto(URL)
for (const name of ['案件_第3ライン.xlsx', 'P-2026-041_x.xlsx', 'a b.xlsx', 'abc.json', 'P-2026-041_第3ライン 搬送制御盤_社内.xlsx']) {
  for (const type of ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/json']) {
    const dlp = page.waitForEvent('download')
    await page.evaluate(([n, t]) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['x'], { type: t })); a.download = n; a.click() }, [name, type])
    const dl = await dlp
    console.log(name, type.slice(0, 20), '→', dl.suggestedFilename())
  }
}
await browser.close()
