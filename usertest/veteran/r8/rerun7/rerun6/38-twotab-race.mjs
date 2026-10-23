// ラウンド5: V4-12 の再確認（編集中に別タブが別案件の JSON で置き換え）。
// 1) 通常: B の読み込みが届いてから A が Enter。2) 競合: B の読み込み確定と A の Enter をほぼ同時（10 回）。
// 3) 届く前の再現: A のページから保存データを P-OTHER に書き換え（storage イベントが来ない＝届く前と同じ）→ A の Enter
import { launch, fresh, goto, toCol, sleep, dumpErrors, save, panel, palette, toastNow, ws, URL, LS_KEY } from './lib.mjs'
const { browser, context, page: A, errors } = await launch()
const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 600)) }
const valIn = async (pg, pid, id) => pg.evaluate(([k, pid, id]) => { const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === pid); const r = p?.rows.find((x) => x.id === id); return r ? (r.working?.name ?? r.name) : null }, [LS_KEY, pid, id])
async function setup() {
  await fresh(A); A._tag = 'A'; await A.keyboard.press('Control+s')
  for (const p of context.pages()) if (p !== A) await p.close()
  const B = await context.newPage(); B._tag = 'B'
  await B.goto(URL); await B.waitForSelector('[data-testid="grid"]'); await B.locator('.gridwrap').focus()
  const w = await ws(A); const other = structuredClone(w); other.projects[0].id = 'P-OTHER'; other.projects[0].name = '別案件'; other.projects[0].createdAt = '2025-01-01T00:00:00.000Z'; other.currentProjectId = 'P-OTHER'
  await A.bringToFront(); await A.locator('.gridwrap').focus(); await A.keyboard.press('1'); await goto(A, 'R030'); await toCol(A, '部品名')
  await A.keyboard.press('Enter'); await A.keyboard.press('Control+a'); await A.keyboard.type('A-while-B-imports')
  return { B, otherText: JSON.stringify(other), orig: w.currentProjectId }
}
async function bImportUpToConfirm(B, text) {
  await B.bringToFront(); await palette(B, 'JSON を読み込む'); await sleep(40)
  await B.evaluate((t) => { const el = document.querySelector('[data-testid="import-text"]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, t); el.dispatchEvent(new Event('input', { bubbles: true })) }, text)
  await B.getByTestId('import-text').focus(); await B.keyboard.press('Control+Enter'); await sleep(80)
  await B.keyboard.press('ArrowDown') // 「置き換える」を選んだ状態（Enter で確定）
}
// 1) 通常
{
  const { B, otherText, orig } = await setup()
  await bImportUpToConfirm(B, otherText); await B.keyboard.press('Enter'); await sleep(300)
  await A.keyboard.press('Enter'); await sleep(200)
  log({ case: '1 normal', toastA: (await toastNow(A)).slice(0, 100), otherR030: await valIn(A, 'P-OTHER', 'R030') })
}
// 2) ほぼ同時
{
  let bad = 0; const recs = []
  for (let i = 0; i < 10; i++) {
    const { B, otherText } = await setup()
    await bImportUpToConfirm(B, otherText)
    await Promise.all([B.keyboard.press('Enter'), A.keyboard.press('Enter')])
    await sleep(400)
    const v = await valIn(A, 'P-OTHER', 'R030')
    if (v === 'A-while-B-imports') bad++
    recs.push({ v, toastA: (await toastNow(A)).slice(0, 60) })
  }
  log({ case: '2 race x10', wroteIntoOther: bad, recs })
}
// 3) 届く前
{
  const { B, otherText } = await setup()
  await A.evaluate(([k, s]) => localStorage.setItem(k, s), [LS_KEY, otherText])
  await A.keyboard.press('Enter'); await sleep(300)
  log({ case: '3 before storage event', toastA: (await toastNow(A)).slice(0, 120), otherR030: await valIn(A, 'P-OTHER', 'R030'), header: await A.evaluate(() => document.querySelector('[data-testid="header"]')?.textContent.slice(0, 30)) })
}
dumpErrors(errors, '38')
save('38-twotab-race.json', out)
await browser.close()
