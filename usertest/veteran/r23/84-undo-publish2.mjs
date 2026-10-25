// ラウンド14: 公開のあとの Ctrl+Z / Ctrl+Y（V13-10 の修正: 公開を戻した操作は Ctrl+Y の側だけ）を、行き来・2 回の公開・リロード・新しい編集・公開し直し・取消を含む公開で
import { open, reset, gotoCell, sleep, logger, state } from './lib22.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`84-undo-publish2-${port}${process.env.RUN ?? ''}.json`)
const info = () => pg.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); const f = (id) => { const r = p.rows.find((x) => x.id === id); return `${id}=${r.name}${r.working ? '/作業中:' + JSON.stringify(r.working).slice(0, 40) : ''}${r.status === 'cancelled' ? '(取消)' : ''}` }; return `${f('R010')} ${f('R011')} ${f('R012')} revs=${p.submissions.map((s) => s.rev).join(',')}` })
const ed = async (id, v) => { await gotoCell(pg, 1, id, '部品名'); await pg.keyboard.type(v); await pg.keyboard.press('Enter'); await sleep(120) }
const pub = async () => { await pg.keyboard.press('Control+Enter'); await sleep(200); const s = await state(pg); if (s.panel) { await pg.keyboard.press('2'); await pg.keyboard.press('Enter') } await sleep(300) }
const K = async (seq, k) => {
  if (k === 'RELOAD' || k === 'RELOAD0') { if (k === 'RELOAD') await sleep(400); await pg.reload(); await pg.waitForSelector('[data-testid="grid"]'); await pg.locator('.gridwrap').focus(); await sleep(300); seq.push(`${k}→${await info()}`); return }
  if (k === 'CANCEL12') { await gotoCell(pg, 1, 'R012', 'ID'); await pg.keyboard.press('Shift+Delete'); await sleep(150); await pg.keyboard.press('Enter'); await sleep(200); seq.push(`R012 取消→${await info()}`); return }
  if (k === 'PUB') { await pub(); seq.push(`公開→${await info()} «${(await state(pg)).toast.slice(0, 90)}»`); return }
  if (k.startsWith('ED:')) { const [id, v] = k.slice(3).split('='); await ed(id, v); seq.push(`${id} 部品名 ${v}→${await info()}`); return }
  await pg.keyboard.press(k); await sleep(250); seq.push(`${k.replace('Control+', 'Ctrl+').replace('z', 'Z').replace('y', 'Y')}→${await info()} «${(await state(pg)).toast.slice(0, 110)}»`)
}
async function S(name, toks, expect) { await reset(env); const seq = [`開始→${await info()}`]; for (const t of toks) await K(seq, t); log({ name, expect, seq }) }
await S('W1 E1 → 公開 → Ctrl+Z → Ctrl+Y → Ctrl+Z → Ctrl+Y → Ctrl+Z', ['ED:R010=E1', 'PUB', 'Control+z', 'Control+y', 'Control+z', 'Control+y', 'Control+z'], '行き来できる（作業中 ↔ 公開済）')
await S('W2 E1 → 公開(Rev.2) → E2 → 公開(Rev.3) → Ctrl+Z ×4', ['ED:R010=E1', 'PUB', 'ED:R010=E2', 'PUB', 'Control+z', 'Control+z', 'Control+z', 'Control+z'], 'Rev.3 だけ戻す（それより前に戻らないと知らせる）')
await S('W3 E1 → 公開 → Ctrl+Z → すぐリロード → Ctrl+Y', ['ED:R010=E1', 'PUB', 'Control+z', 'RELOAD0', 'Control+y', 'Control+z'], 'リロード後も Ctrl+Y で公開済の値に戻せる')
await S('W4 E1 → 公開 → Ctrl+Z → R011 を F1 → Ctrl+Y', ['ED:R010=E1', 'PUB', 'Control+z', 'ED:R011=F1', 'Control+y', 'Control+z', 'Control+z'], '新しい編集のあとの Ctrl+Y は何もしない')
await S('W5 E1 → 公開 → Ctrl+Z → もう一度公開（Rev.3）→ Ctrl+Y → Ctrl+Z', ['ED:R010=E1', 'PUB', 'Control+z', 'PUB', 'Control+y', 'Control+z'], '公開し直したあとの Ctrl+Y で古い値に戻さない')
await S('W6 E1・R011 F1 → 公開 → Ctrl+Z → Ctrl+Z → Ctrl+Y ×2', ['ED:R010=E1', 'ED:R011=F1', 'PUB', 'Control+z', 'Control+z', 'Control+y', 'Control+y'], '2 回目は止まる。Ctrl+Y で公開済へ')
await S('W7 R012 を取消（Shift+Delete）＋ R010 E1 → 公開 → Ctrl+Z → Ctrl+Y', ['ED:R010=E1', 'CANCEL12', 'PUB', 'Control+z', 'Control+y'], '取消は戻せない、E1 は作業中 ↔ 公開済')
await S('W8 E1 → 公開 → R010 を E9（作業中）→ Ctrl+Z → Ctrl+Z → Ctrl+Y → Ctrl+Y', ['ED:R010=E1', 'PUB', 'ED:R010=E9', 'Control+z', 'Control+z', 'Control+y', 'Control+y'], 'E9 を戻す → 公開を戻す → Ctrl+Y で逆順に')
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
