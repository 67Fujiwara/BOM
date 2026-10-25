// ラウンド15: 公開を戻す Ctrl+Z（V14-11 の修正: 公開を戻したら、それより前の公開も Ctrl+Z では戻さない）の境目。
// 前の公開にだけ含まれる行の編集・指摘・直前の Rev に追記・別の案件・リロード
import { open, reset, gotoCell, sleep, logger, state } from './lib19.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`99-undo-publish3-${port}${process.env.RUN ?? ''}.json`)
const info = () => pg.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); const f = (id) => { const r = p.rows.find((x) => x.id === id); return `${id}=${r.name}${r.working ? '/作業中:' + (r.working.name ?? JSON.stringify(r.working).slice(0, 30)) : ''}` }; const subs = p.submissions.map((s) => `Rev.${s.rev}[${Object.entries(s.snapshot ?? {}).filter(([k]) => ['R010', 'R020'].includes(k)).map(([k, v]) => k + ':' + v.name).join(',')}]`); return `${f('R010')} ${f('R020')} 指摘${p.issues.length} ${subs.slice(-3).join(' ')}` })
const ed = async (id, v) => { await gotoCell(pg, 1, id, '部品名'); await pg.keyboard.type(v); await pg.keyboard.press('Enter'); await sleep(120) }
const pub = async (choice = '2') => { await pg.keyboard.press('Control+Enter'); await sleep(200); const s = await state(pg); if (s.panel) { await pg.keyboard.press(choice); await pg.keyboard.press('Enter') } await sleep(300); const s2 = await state(pg); if (s2.panel) { await pg.keyboard.press(choice); await pg.keyboard.press('Enter'); await sleep(300) } }
const K = async (seq, k) => {
  if (k === 'RELOAD') { await sleep(400); await pg.reload(); await pg.waitForSelector('[data-testid="grid"]'); await pg.locator('.gridwrap').focus(); await sleep(300); seq.push(`${k}→${await info()}`); return }
  if (k.startsWith('PUB')) { await pub(k === 'PUB-APPEND' ? '2' : '1'); seq.push(`${k}→${await info()} «${(await state(pg)).toast.slice(0, 90)}»`); return }
  if (k.startsWith('ED:')) { const [id, v] = k.slice(3).split('='); await ed(id, v); seq.push(`${id} 部品名 ${v}→${await info()}`); return }
  await pg.keyboard.press(k); await sleep(250); seq.push(`${k.replace('Control+', 'Ctrl+').replace('z', 'Z').replace('y', 'Y')}→${await info()} «${(await state(pg)).toast.slice(0, 140)}»`)
}
async function S(name, toks, expect) { await reset(env); const seq = [`開始→${await info()}`]; for (const t of toks) await K(seq, t); log({ name, expect, seq }) }
await S('U1 R020 A1・R010 E1 → 公開(Rev.2) → R010 E2 → 公開(Rev.3) → Ctrl+Z ×3', ['ED:R020=A1', 'ED:R010=E1', 'PUB', 'ED:R010=E2', 'PUB', 'Control+z', 'Control+z', 'Control+z'], '2 回目以降は「これ以上戻す操作がありません」。R020 は Rev.2 の A1 のまま（作業中にしない）')
await S('U2 同じ流れでリロードを挟む', ['ED:R020=A1', 'ED:R010=E1', 'PUB', 'ED:R010=E2', 'PUB', 'RELOAD', 'Control+z', 'RELOAD', 'Control+z', 'Control+z'], 'U1 と同じ')
await S('U3 R020 A1 → 公開(Rev.2) → R010 E1 → 公開(Rev.3) → Ctrl+Z ×2', ['ED:R020=A1', 'PUB', 'ED:R010=E1', 'PUB', 'Control+z', 'Control+z'], 'R020 の A1 は戻さない')
await S('U4 R010 E1 → 公開(Rev.2) → R010 E2 → 公開（直前の Rev に追記）→ Ctrl+Z → Ctrl+Y', ['ED:R010=E1', 'PUB', 'ED:R010=E2', 'PUB-APPEND', 'Control+z', 'Control+y'], 'Rev.2 の中身と行の公開値がそろう')
await S('U5 R010 E1 → 公開 → R010 E2 → 公開 → Ctrl+Z → Ctrl+Y → Ctrl+Y → Ctrl+Z ×2', ['ED:R010=E1', 'PUB', 'ED:R010=E2', 'PUB', 'Control+z', 'Control+y', 'Control+y', 'Control+z', 'Control+z'], '行き来できる・2 回目は止まる')
await S('U6 R020 A1 → 公開 → R010 E1 → (公開しない) → Ctrl+Z ×3', ['ED:R020=A1', 'PUB', 'ED:R010=E1', 'Control+z', 'Control+z', 'Control+z'], 'E1 を戻す → 公開を戻す → 止まる')
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log({ name: 'console/pageerror', errs: env.errs.slice(0, 20) })
log.save(); await env.browser.close()
