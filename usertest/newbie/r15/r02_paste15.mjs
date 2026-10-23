// ラウンド15: ガイド「1 貼り付け」（Excel からコピー）で、ラウンド14 の取り込みの直し（表題欄・変更図の削除・〃）の周り。cases/*.json の [題, TSV] を順に
import fs from 'node:fs'
import { launch, makeLog, sleep, shot } from './lib.mjs'
import { wizardPaste, createAndPublish } from './w15.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 'r02_paste15')
const files = process.argv.slice(2)
for (const cf of files) for (const [title, text] of JSON.parse(fs.readFileSync(cf, 'utf8'))) {
  if (process.env.ONLY && !title.startsWith(process.env.ONLY)) continue
  try {
    const pv = await wizardPaste(page, text)
    log(`[${title}] preview: ${pv.slice(0, 1000)}`)
    await shot(page, 'r02_' + title.split(' ')[0] + '_preview')
    await createAndPublish(page, log)
  } catch (e) { log('EXC', title, String(e).slice(0, 300)) }
}
save(errors); await browser.close()
