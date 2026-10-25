// n16: 選定済の行を支給品・社内在庫に切り替えたあとの行の扱い（ボール・購買待ち・ビュー）。ラウンド19 の参考の再確認
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const mode = process.argv[2] ?? '支給品'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('design'); log('bulk →', await t.bulk()); let p = await t.proj()
const X = p.rows.find((r) => r.status === 'selected' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG).id
const hdr = async () => { const s = await t.header(); return (s.match(/購買待ち\s*(\d+)/) ?? [])[1] }
await t.role('purchasing'); const w0 = await hdr(); await t.role('design')
await t.press('1'); await t.showCol('procurement'); log(await t.setCellKey(X, 'procurement', mode)); log('publish →', (await t.publish('1')).slice(0, 80))
p = await t.proj(); const r = p.rows.find((x) => x.id === X); log('X', h.show(p, X), 'ball', await h.ballOf(X))
await t.role('purchasing'); const w1 = await hdr()
log('購買待ち before', w0, 'after', w1)
await t.press('3'); const in3 = (await t.viewRows()).includes(X); await t.press('8'); const in8 = (await t.viewRows()).includes(X)
log('purchasing view 3/8 has X', in3, in8, '| status bar', (await t.status()).slice(0, 160))
await t.goto(X); await t.press('Home'); log('status bar on X', (await t.status()).slice(0, 220))
check(`N16-1 ${mode}に切り替えた行は、購買の待ちに数えない（商社に頼まない行なので購買は何もできない）`, (await h.ballOf(X)) !== 'purchasing', `ball=${await h.ballOf(X)} 購買待ち ${w0} → ${w1}`)
check(`N16-2 ${mode}の行は正式見積(8)・発注(3)のビューに出ない`, !in3 && !in8, `in3=${in3} in8=${in8}`)
log('ERRORS', JSON.stringify(t.errors))
summary(); await t.close()
