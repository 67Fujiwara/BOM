// ラウンド16: ガイド「2 ファイル」で files16/ の xlsx を読み、知らせのまま Enter → Enter → Ctrl+Enter（最初の公開）
import fs from 'node:fs'
import { launch, makeLog, sleep } from './lib.mjs'
import { wizardFile, createAndPublish } from './w15.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 'r11_files16')
const D = '/home/user/BOM/usertest/newbie/r19/files16/'
const files = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(D).sort()
for (const f of files) {
  try {
    const { toast, pv } = await wizardFile(page, D + f)
    log(`[${f}] load toast: ${toast}`)
    log(`   preview: ${pv.slice(0, 1200)}`)
    await createAndPublish(page, log, `r11_${f.replace(/\W/g, '_')}`)
  } catch (e) { log('EXC', f, String(e).slice(0, 300)) }
}
save(errors); await browser.close()
