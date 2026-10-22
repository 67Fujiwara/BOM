import { launch, check, log } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
// 指摘対応 + 設計変更を混ぜて公開
await t.setCell('R016', '型式', 'CP30-BA 2P 1-M 10A') // I-001 型式あいまい の対応
await t.setCell('R043', 'メーカ', 'オムロン')         // 指摘なし（変更セット）
await t.press('Control+Enter'); await page.waitForTimeout(100)
log('dialog:', await page.locator('[role=dialog]').textContent().catch(() => ''))
await t.press('2'); await page.waitForTimeout(200)
log('after 2 dialog:', await page.locator('[role=dialog]').textContent().catch(() => ''), 'toast:', await t.toast())
const p = await t.proj()
log('submissions:', p.submissions.map((s) => `Rev${s.rev} ${s.rowIds.length} cs=${JSON.stringify(s.changeSet)} causes=${JSON.stringify(s.causes)}`))
log('I-001:', p.issues.find((i) => i.id === 'I-001').status, 'R016 flags:', JSON.stringify(p.rows.find((r) => r.id === 'R016').flags), 'R043 flags:', JSON.stringify(p.rows.find((r) => r.id === 'R043').flags))
log('ERRORS:', t.errors)
await t.close()
