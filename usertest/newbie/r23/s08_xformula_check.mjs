import { launch, makeLog } from './lib.mjs'
import { wizardFile, createAndPublish } from './w15.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('s08_xformula_check')
for (const f of ['x_formula.xlsx', 'y_errors.xlsx']) {
  const { toast, pv } = await wizardFile(page, '/home/user/BOM/usertest/newbie/r23/files7/' + f)
  log(`[${f}] toast=${toast} preview=${pv.slice(0, 260)}`)
}
save(errors); await browser.close()
