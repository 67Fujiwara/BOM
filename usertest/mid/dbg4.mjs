import { launch, check, log } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
await t.setCell('R044', '型式', 'KIV 1.25 黒 600V') // 設計変更のみ
await t.press('Control+Enter'); await page.waitForTimeout(100)
log('dialog:', (await page.locator('[role=dialog]').textContent().catch(() => '')).slice(0, 60))
await t.press('2')
for (const w of [0, 100, 500]) { await page.waitForTimeout(w); log(`toast after +${w}ms:`, JSON.stringify(await t.toast())) }
const p = await t.proj()
log('submissions:', p.submissions.map((s) => `Rev${s.rev}`), 'events tail:', p.events.slice(-2).map((e) => e.text))
check('DBG 変更理由を答えた後に「公開しました」のトーストが出る', /公開しました/.test(await t.toast()), await t.toast())
log('ERRORS:', t.errors)
await t.close()
