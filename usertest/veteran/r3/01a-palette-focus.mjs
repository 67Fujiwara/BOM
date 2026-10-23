// V2-01 パレット正式名（3 役割 × keymap 全ラベル＋パレット専用全名称）/ V2-17 最近使った順 / V2-08 ヘルプのキーでのスクロール
// V2-09 パネル内 Tab / V2-10 既定動作の漏れ（編集・パネル・絞り込み）/ V2-23 Ctrl+Enter 2 度押し
import fs from 'node:fs'
import { launch, fresh, setRole, goto, toCol, cursor, mode, sleep, dumpErrors, save, proj, panel, closeAll, palette, toastNow, shot } from './lib.mjs'
const src = fs.readFileSync('/home/user/BOM/src/keys/keymap.ts', 'utf8')
const KM = [...src.matchAll(/\{ id: '([^']+)', keys: \[([^\]]+)\], mode: '(\w+)', section: '([^']+)', label: '([^']+)'/g)].map((m) => ({ id: m[1], label: m[5] }))
const reg = fs.readFileSync('/home/user/BOM/src/commands/registry.ts', 'utf8')
const stBlock = reg.slice(reg.indexOf('export const STATIC'), reg.indexOf('const QUIT_WORDS'))
const STATIC = [...stBlock.matchAll(/\{ id: '([^']+)', label: '([^']+)'/g)].map((m) => ({ id: m[1], label: m[2] }))
const staticById = new Map(STATIC.map((s) => [s.id, s.label]))
console.log('keymap', KM.length, 'static', STATIC.length)
const { browser, page, errors } = await launch()
const out = { palette: {}, recent: null, help: null, tab: [], leak: [], ctrlEnter2: null }
for (const role of ['design', 'purchasing', 'pm']) {
  await fresh(page, role)
  const bad = []
  let n = 0
  for (const e of [...KM.map((k) => ({ ...k, src: 'keymap' })), ...STATIC.map((s) => ({ ...s, src: 'static' }))]) {
    await page.keyboard.press('Control+k')
    await page.getByTestId('palette-input').fill(e.label)
    await sleep(5)
    const items = await page.evaluate(() => [...document.querySelectorAll('[data-testid="palette-list"] .item')].map((el) => el.children[1]?.textContent ?? el.textContent))
    await page.keyboard.press('Escape')
    n++
    const ok = items[0] === e.label || items[0] === staticById.get(e.id)
    if (!ok) bad.push({ src: e.src, id: e.id, typed: e.label, first: items[0], pos: items.findIndex((x) => x === e.label || x === staticById.get(e.id)) })
  }
  out.palette[role] = { checked: n, notFirst: bad }
  console.log(role, n, 'notFirst', bad.length, JSON.stringify(bad).slice(0, 600))
}
// 実行して本当にそのコマンドが走るか（社外向け・データ変更系を抜粋）
{
  const run = []
  await fresh(page, 'purchasing')
  for (const [typed, expectPanelOrToast] of [['見積回答を取り込む', /取り込|商社/], ['正式見積を依頼（社外）', /正式/], ['商社を追加', /商社を追加/], ['ルールを追加', /ルール/], ['ショートカット一覧', /help|ショートカット/], ['案件設定を確定（PM）', /確定|PM/], ['この行だけ重みを変える', /重み/], ['退避したデータを書き出す', /退避/], ['読み込み前に戻す', /退避|戻/]]) {
    await goto(page, 'R030')
    await palette(page, typed); await sleep(60)
    const p = await panel(page)
    const title = p ? ((await page.locator('[data-testid^="panel-"]').first().textContent()) ?? '').slice(0, 80) : ''
    const t = (await toastNow(page)).slice(0, 80)
    run.push({ typed, panel: p, title, toast: t, match: expectPanelOrToast.test((p ?? '') + title + t) })
    await closeAll(page)
  }
  out.paletteRun = run
  console.log('run', JSON.stringify(run))
}
// V2-17 最近使った順
{
  await fresh(page)
  for (const c of ['ダークモード切替', 'コンパクト表示切替']) { await palette(page, c); await sleep(30) }
  await page.keyboard.press('Control+k'); await sleep(20)
  const top = await page.evaluate(() => [...document.querySelectorAll('[data-testid="palette-list"] .item')].slice(0, 3).map((el) => el.children[1]?.textContent))
  await page.keyboard.press('Escape')
  // 一致度が同じとき（「切替」）
  await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('切替'); await sleep(10)
  const top2 = await page.evaluate(() => [...document.querySelectorAll('[data-testid="palette-list"] .item')].slice(0, 3).map((el) => el.children[1]?.textContent))
  await page.keyboard.press('Escape')
  for (const c of ['ダークモード切替', 'コンパクト表示切替']) { await palette(page, c); await sleep(30) }
  out.recent = { emptyQueryTop: top, query切替Top: top2 }
  console.log('recent', JSON.stringify(out.recent))
}
// V2-08 ヘルプ
{
  await fresh(page)
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.keyboard.press('?'); await sleep(50)
  const sc = async () => page.evaluate(() => { const b = document.querySelector('.overlay .dialog .body'); return b ? { st: Math.round(b.scrollTop), sh: b.scrollHeight, ch: b.clientHeight } : null })
  const r = { start: await sc() }
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); r.down2 = await sc()
  await page.keyboard.press('PageDown'); r.pgdn = await sc()
  await page.keyboard.press('Space'); r.space = await sc()
  await page.keyboard.press('End'); r.end = await sc()
  await shot(page, '01a-help-end-720')
  await page.keyboard.press('Shift+Space'); r.shiftSpace = await sc()
  await page.keyboard.press('Home'); r.home = await sc()
  await page.keyboard.press('j'); r.j = await sc()
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 1440, height: 900 })
  out.help = r
  console.log('help', JSON.stringify(r))
}
// V2-09 Tab / Shift+Tab がダイアログ内に留まるか
{
  const active = () => page.evaluate(() => { const a = document.activeElement; const inDlg = !!a?.closest('.overlay'); return { tag: a?.dataset?.testid ?? a?.tagName, inDlg } })
  const cases = {
    goto: async () => page.keyboard.press('Control+g'),
    palette: async () => page.keyboard.press('Control+k'),
    wizard: async () => { await palette(page, '新しいBOM'); await sleep(30) },
    import: async () => { await palette(page, 'JSON を読み込む'); await sleep(30) },
    inbox: async () => page.keyboard.press('Control+p'),
    settingsEdit: async () => { await setRole(page, 'pm'); await palette(page, '案件設定'); await page.keyboard.press('Enter') },
    confirm: async () => { await palette(page, 'サンプルデータに戻す') },
    reply: async () => { await goto(page, 'R016'); await page.keyboard.press('Shift+R') },
    issueText: async () => { await setRole(page, 'purchasing'); await goto(page, 'R030'); await page.keyboard.press('Shift+I'); await page.keyboard.press('k') },
    quotesImport: async () => { await setRole(page, 'purchasing'); await palette(page, '見積回答を取り込む'); await sleep(30); await page.keyboard.press('Enter') },
  }
  for (const [name, open] of Object.entries(cases)) {
    for (const k of ['Tab', 'Shift+Tab', 'Tab+Tab+Tab']) {
      await fresh(page)
      await open(); await sleep(40)
      const p0 = await panel(page)
      for (const kk of k.split('+Tab').length > 2 ? ['Tab', 'Tab', 'Tab'] : [k]) await page.keyboard.press(kk)
      await page.keyboard.type('zz'); await sleep(20)
      const a = await active()
      const filter = await page.getByTestId('filter').inputValue()
      out.tab.push({ name, k, panelBefore: p0, panelAfter: await panel(page), active: a, gridFilter: filter, mode: await mode(page) })
      if (!a.inDlg || filter) console.log('TAB-ESCAPE', name, k, JSON.stringify(a), filter)
    }
  }
}
// V2-10 既定動作の漏れ（編集中・パネル・絞り込み）
{
  await fresh(page)
  await page.evaluate(() => { window.__k = []; window.addEventListener('keydown', (e) => window.__k.push({ key: e.key, p: e.defaultPrevented }), false) })
  const last = () => page.evaluate(() => window.__k.at(-1))
  const KEYS = ['Alt+ArrowLeft', 'Alt+ArrowRight', 'Control+g', 'Control+Shift+C', 'Control+Shift+F', 'Control+Period', 'Control+s', 'Control+p', 'Control+e', 'Control+BracketLeft', 'Control+BracketRight', 'Control+d', 'Control+f', 'Control+h', 'Control+j', 'Control+l', 'Control+n', 'Control+o', 'Control+r', 'Control+t', 'Control+u', 'Control+w', 'F1', 'F3', 'F5', 'F6', 'F7', 'F11', 'F12', 'Alt+Home', 'Control+Shift+Delete', 'Control+Shift+I', 'Control+Shift+J', 'Control+Shift+N', 'Control+Shift+T', 'Control+Tab', 'Control+Plus', 'Control+Minus', 'Control+0']
  const ctx = {
    nav: async () => { await closeAll(page); await goto(page, 'R020') },
    edit: async () => { await closeAll(page); await goto(page, 'R020'); await page.keyboard.press('Enter') },
    palette: async () => { await closeAll(page); await page.keyboard.press('Control+k') },
    filter: async () => { await closeAll(page); await page.keyboard.press('/'); await page.keyboard.type('リ') },
    wizard: async () => { await closeAll(page); await palette(page, '新しいBOM') },
  }
  for (const [c, setup] of Object.entries(ctx)) {
    for (const k of KEYS) {
      await setup()
      const url0 = page.url()
      await page.keyboard.press(k).catch(() => {})
      await sleep(15)
      const l = await last()
      if (page.url() !== url0) { out.leak.push({ ctx: c, k, navigated: page.url() }); await page.goBack().catch(() => {}); continue }
      if (l && !l.p) out.leak.push({ ctx: c, k, prevented: false })
    }
  }
  console.log('leak (not prevented)', out.leak.length, JSON.stringify(out.leak).slice(0, 1500))
}
// V2-23 Ctrl+Enter 2 度押し
{
  await fresh(page)
  await goto(page, 'R030'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('連打テスト'); await page.keyboard.press('Enter')
  const subs0 = (await proj(page)).submissions.length
  await page.keyboard.press('Control+Enter'); await page.keyboard.press('Control+Enter'); await sleep(80)
  const p1 = await panel(page)
  const subs1 = (await proj(page)).submissions.length
  out.ctrlEnter2 = { subs0, subs1, panelStillOpen: p1, toast: (await toastNow(page)).slice(0, 100) }
  console.log('ctrlEnter2', JSON.stringify(out.ctrlEnter2))
  await closeAll(page)
}
save('01a-palette-focus.json', out)
dumpErrors(errors, '01a')
await browser.close()
