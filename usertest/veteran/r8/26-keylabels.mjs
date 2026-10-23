// ラウンド8: サイドバー・パレット・ヘルプのキー表示が、カーソルの列で押せる形か（V6-05）。部品名 / ID / 単価（自動計算）/ 購買の部品名 / PM
import { open, reset, gotoCell, sleep, saveJson, state } from './lib8.mjs'
const env = await open(5176); const pg = env.page; const out = []
for (const [role, view, row, col] of [['design', 1, 'R040', '部品名'], ['design', 1, 'R040', 'ID'], ['design', 1, 'R040', '単価'], ['purchasing', 1, 'R040', '部品名'], ['pm', 7, null, null]]) {
  await reset(env, { role }); if (row) await gotoCell(pg, view, row, col); else { await pg.keyboard.press(`Alt+${view}`); await pg.keyboard.press('ArrowDown') }
  const side = await pg.evaluate(() => [...document.querySelectorAll('[data-testid^="view-"] .k')].map((x) => x.textContent).join(' '))
  await pg.keyboard.press('Control+k'); await sleep(80)
  const pal = await pg.evaluate(() => [...document.querySelectorAll('[data-testid="panel-palette"] .keys')].map((k) => k.parentElement.textContent.replace(/\s+/g, '')).filter((t) => /隠す|次の問題|絞り込み検索|ショートカット|前の分類|ビュー: 要確認|推奨/.test(t)))
  await pg.keyboard.press('Escape'); await sleep(50)
  await pg.keyboard.press('F1'); await sleep(80)
  const help = await pg.evaluate(() => [...document.querySelectorAll('[data-testid="help"] .r')].map((r) => r.textContent.replace(/\s+/g, '')).filter((t) => /^(絞り込み検索|ショートカット一覧|前の分類|行を隠す|次の問題|ビュー:要確認|推奨)/.test(t)))
  if (role === 'design' && col === '部品名') await pg.screenshot({ path: '/home/user/BOM/usertest/veteran/r8/shots/26-help-name.png' })
  await pg.keyboard.press('Escape')
  const rec = { role, col, cursor: (await state(pg)).cursor, side, pal, help }
  out.push(rec); console.log(JSON.stringify(rec))
}
saveJson('26-keylabels.json', out); await env.browser.close()
