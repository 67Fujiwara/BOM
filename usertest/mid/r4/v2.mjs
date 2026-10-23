// v2: 指摘の流れ（購買の起票 → 設計の対応 → 購買の 5 確認 / 要再確認）
// 再検証: U-07, M-11(c,d), M-38, M-26, M-27, M-12, M-28, M-35, M-24
import { launch, check, log, summary } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('purchasing')
await t.press('1')
// 代替提案 2 件を R030 に（提案欄つき）。1 件目は本文で Ctrl+Enter → 次の行でも同じ種別から続ける（U-07）
async function raise(id, key, text, prop, cont = false) {
  await t.goto(id); await t.press('Shift+I'); await page.waitForTimeout(40); await t.press(key); await page.waitForTimeout(40)
  await page.getByTestId('issue-text').fill(text)
  if (prop) {
    await page.getByTestId('issue-text').press('Tab'); await page.waitForTimeout(40)
    for (const [k, v] of Object.entries(prop)) await page.getByTestId('proposal-' + k).fill(String(v))
    await page.getByTestId('proposal-model').press(cont ? 'Control+Enter' : 'Enter')
  } else await page.getByTestId('issue-text').press(cont ? 'Control+Enter' : 'Enter')
  await page.waitForTimeout(60)
  return t.toast()
}
log(await raise('R030', 'a', '同等品の提案1', { model: 'M22N-BC-TWA-WC2', maker: 'オムロン', supplierId: 'S2', unitPrice: 900, leadDays: 5 }))
log(await raise('R030', 'a', '同等品の提案2', { model: 'M22N-BC-TWA-WC3', maker: 'オムロン', supplierId: 'S1', unitPrice: 950, leadDays: 4 }))
// U-07: 本文で Ctrl+Enter → 次の行で同じ種別
await t.goto('R044'); await t.press('Shift+I'); await t.press('q'); await page.getByTestId('issue-text').fill('取付ピッチは？'); await page.getByTestId('issue-text').press('Control+Enter'); await page.waitForTimeout(80)
let pn = await t.panel(); log('after Ctrl+Enter in text:', JSON.stringify(pn)?.slice(0, 150), 'cur', await t.curRow())
check('U-07 本文で Ctrl+Enter → 次の行で同じ種別の本文から続けられる', pn?.kind === 'issue')
if (pn) { await page.getByTestId('issue-text').fill('こちらも取付ピッチは？'); await page.getByTestId('issue-text').press('Enter'); await page.waitForTimeout(60) }
log(await raise('R036', 'l', ''))
log(await raise('R040', 'h', '発注後の変更の相談'))
log(await raise('R050', 'r', '必要数を減らせますか'))
await t.press('Control+Enter'); await page.waitForTimeout(80); let d = await t.panel(); log('publish dialog', JSON.stringify(d)?.slice(0, 150)); if (d) { await t.press('Enter'); await page.waitForTimeout(80) }
log('issue publish →', await t.toast())
let p = await t.proj(); log('issues:', p.issues.map((i) => `${i.id}:${i.rowId}:${i.kind}:${i.status}`).join(' '))

// 設計: 4 の中身
await t.role('design')
let v4 = await t.viewRows(); log('design 4:', v4.join(','))
const ball = async (id) => t.cellText(id, 'ball')
log('ball R036', await ball('R036'), 'R040', await ball('R040'), 'R050', await ball('R050'))
check('M-11d 購買が対応する指摘（最小ロット・発注後変更依頼）の行は設計の 4 に出ない（他の理由がなければ）', !v4.includes('R036') || (await ball('R036')) === '設計', `R036 in4=${v4.includes('R036')} ball=${await ball('R036')}`)
// M-11c: R016（型式あいまい）の備考だけ変えて公開 → 対応中で 4 に残る
await t.press('1'); log(await t.setCellKey('R016', 'note', '定格は確認中'))
// R009 メーカ未記入を直す
log(await t.setCellKey('R009', 'maker', 'フエニックス'))
// R041 メーカ未記入は直さず回答（M-27 番号キー 2）
await t.goto('R041'); await t.press(' '); await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(60)
pn = await t.panel(); log('R041 issue panel:', JSON.stringify(pn?.options))
await t.press('2'); await page.waitForTimeout(60); pn = await t.panel(); log('after 2:', JSON.stringify(pn)?.slice(0, 120))
check('M-27 指摘パネルで仕様の番号（2 直さず回答）が効く', pn?.kind === 'prompt' && /回答/.test(pn.title))
if (pn) { await t.promptFill('支給品のためメーカ空欄'); await t.press('Enter'); await page.waitForTimeout(60) }
await t.press('Escape')
// R050 数量見直し依頼（購買起票）に 7 が出るか（仕様は PM 起票の指摘への回答）
await t.goto('R050'); await t.press(' '); await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(60)
pn = await t.panel(); log('R050 (購買起票の数量見直し) panel:', JSON.stringify(pn?.options)); await t.press('Escape'); await t.press('Escape')
const r050opt7 = (pn?.options ?? []).some((o) => o.startsWith('7 '))
// R030 提案を適用（Ctrl+.）
await t.goto('R030'); await t.colKey('model'); await t.press('Control+.'); await page.waitForTimeout(60); pn = await t.panel(); log('R030 Ctrl+. :', JSON.stringify(pn?.options))
await t.press('1'); await page.waitForTimeout(150); if ((await t.mode()) === 'edit') await t.press('Escape')
p = await t.proj(); const nr = p.rows.find((r) => r.replaces === 'R030'); log('new row', nr?.id, nr?.status, JSON.stringify(nr?.flags))
log('R030 issues:', p.issues.filter((i) => i.rowId === 'R030').map((i) => `${i.id}:${i.status}:${i.resolution}`).join(' | '))
check('M-38 同じ行の他の代替提案は「見送り（I-0xx を適用）」', p.issues.filter((i) => i.rowId === 'R030' && i.kind === '代替提案').some((i) => i.status === 'wontfix' && /見送り（I-\d+ を適用）/.test(i.resolution ?? '')))
// 取消（Shift+Delete）と行追加
await t.goto('R070'); await t.press('Shift+Delete'); await page.waitForTimeout(60); log('cancel R070 →', await t.toast())
// 取消直後（未公開）に購買から見えるか
await t.role('purchasing'); await t.press('1')
const st70 = await t.cellText('R070', 'status'); log('purchasing sees R070 status before publish:', st70)
check('M3 取消は公開まで購買に見えない（作業中の分離）', !/取消/.test(st70), st70)
await t.role('design'); await t.press('1')
await t.goto('R016'); await t.colKey('model'); await t.press('x'); log('ack R016 →', await t.toast())
await t.press('Control+Enter'); await page.waitForTimeout(100); { const d0 = await t.panel(); log('publish try1:', JSON.stringify(d0)?.slice(0,100), await t.toast()); if (d0) await t.press('Escape') }
await t.goto(nr.id); await t.colKey('ref'); await t.press('x'); log('x dup ref on', nr.id, '→', await t.toast())
// 公開
await t.press('Control+Enter'); await page.waitForTimeout(100); d = await t.panel(); log('publish dialog:', JSON.stringify(d)?.slice(0, 220))
if (d?.kind === 'prompt' && d.options?.includes('客先要求')) { await t.press('1'); await page.waitForTimeout(80) } else if (d) { await t.press('Enter'); await page.waitForTimeout(80) }
await page.waitForTimeout(50); d = await t.panel(); if (d) { log('2nd dialog', JSON.stringify(d).slice(0, 150)); await t.press('Enter'); await page.waitForTimeout(80) }
log('publish →', await t.toast())
p = await t.proj(); log('subs:', p.submissions.map((s) => `Rev${s.rev}[${s.rowIds.join(',')}] cs=${s.changeSet?.reason ?? '-'} causes=${JSON.stringify(s.causes)}`).join(' / '))
log('R016 issue:', p.issues.filter((i) => i.rowId === 'R016').map((i) => i.status))
v4 = await t.viewRows().catch(() => []); await t.press('4'); v4 = await t.viewRows(); log('design 4 after publish:', v4.join(','))
check('M-11c 対応中（指摘セル未変更）の行が設計の 4 に残る', v4.includes('R016'))
check('M-28 取消は変更セット（理由つき）の Rev に入る', p.submissions.some((s) => s.rowIds.includes('R070') && s.changeSet))

// 購買: 5 変更あり（Rev 横断・起因列）
await t.role('purchasing'); await t.press('5')
const v5 = await t.viewRows(); const cols5 = await page.locator('thead th').allTextContents(); log('purchasing 5:', v5.join(','), 'cols:', cols5.join('|'))
const causes = []; for (const id of v5) causes.push(id + '=' + (await t.cellText(id, 'cause')))
log('causes:', causes.join(' '))
check('M-12 5 変更あり: Rev 横断で未確認の差分すべて＋起因列', cols5.some((c) => c.includes('起因')) && ['R009', 'R016', nr?.id, 'R070'].every((x) => v5.includes(x)), v5.join(','))
// M-26: 提案適用の新行 → Ctrl+. に 据え置き / 再見積 / 提案値で確定
await t.goto(nr.id); await t.press('Control+.'); await page.waitForTimeout(60); pn = await t.panel(); log(nr.id, 'Ctrl+. :', JSON.stringify(pn?.options))
check('M-26 提案適用の新行で購買が商社ごとに 据え置き / 再見積 / 提案値で確定 を選べる', (pn?.options ?? []).some((o) => /提案値で確定/.test(o)) && (pn?.options ?? []).some((o) => /据え置き/.test(o)))
await t.press('Escape')
// 商社ごとに選ぶ: S2=提案値、S1=据え置き、S3=据え置き
async function pick(label) { await t.goto(nr.id); await t.press('Control+.'); await page.waitForTimeout(50); const o = (await t.panel())?.options ?? []; const i = o.findIndex((x) => x.includes(label)); if (i < 0) { log('NO OPTION', label, o); await t.press('Escape'); return } for (let k = 0; k < i; k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(60) }
await pick('立花エレテック: 提案値で確定'); await pick('因幡電機: 据え置き'); await pick('ミスミ: 据え置き')
let rn = await t.row(nr.id); const qn = (await t.quotes(nr.id)).filter((q) => !q.stale)
log('new row after reconfirm:', rn.status, JSON.stringify(rn.flags), JSON.stringify(qn.map((q) => [q.supplierId, q.unitPrice, q.leadDays, q.reconfirm])))
check('M3 要再確認を全商社「据え置き / 提案値」で決めると見積済になり選定できる', rn.status === 'quoted', rn.status)
await t.role('design'); await t.goto(nr.id); await t.press('a'); log('design a on new row →', await t.toast())
// M-27 見積パネルの番号
await t.role('purchasing')
summary()
log('R050 (購買起票の数量見直し依頼) に 7 対策不成立 が出る:', r050opt7)
await t.close()
