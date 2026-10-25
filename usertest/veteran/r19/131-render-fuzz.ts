// ラウンド18: 120-normalize-fuzz の続き。sanitize を通り、起動時の normalize も通ったデータで、画面を描くときに呼ぶ関数
// （ビュー 1〜9 の filter・全部の列の cellText / cellSev・scoreRow・totals・ballCounts・buildProblems・quoteComplete・daysLeft など）が例外を出すか。
// 起動時の整え直しは try/catch で包まれた（ラウンド17）が、描画の例外は ErrorBoundary の「エラー」画面になる。
// vite-node で現行と r17 ビルド（SRC=scratchpad の 783edde）。SEED・N で乱数を変える
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { sanitizeWorkspace } = await import(SRC + '/model/validate.ts')
const { normalize } = await import(SRC + '/model/lifecycle.ts')
const { makeWorkspace } = await import(SRC + '/model/sample.ts')
const { setSupplierMaster } = await import(SRC + '/model/rules.ts')
const { VIEWS, buildProblems } = await import(SRC + '/model/views.ts')
const { COLUMNS } = await import(SRC + '/model/columns.ts')
const sel = await import(SRC + '/model/selectors.ts')
const der = await import(SRC + '/model/derive.ts')
const score = await import(SRC + '/model/score.ts')
import fs from 'node:fs'

const base = JSON.parse(JSON.stringify(makeWorkspace()))
const VALUES: unknown[] = [null, 0, -1, 1e308, -1e308, 'abc', '', {}, [], [1], { a: 1 }, true, false, '__proto__', '2026-02-30', 'NaN', '-1', '1,000', 1e12, 1e13, -1e12, 'R001', 'S1', 'S2', '在庫', 'formalRequested', 'selected', ['S1', 5], 12.5, '9999-12-31', '0000-01-01', '2026-10-23T25:61:00', 'x'.repeat(5000), '20261201', 46337, '2026/12/01', -0.5, 0.0001, ' ', '\u0000', '<img src=x onerror=alert(1)>', 'toString', 'constructor', 'hasOwnProperty']
let seed = Number(process.env.SEED ?? 18)
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)]

function mutate(ws: any): string[] {
  const done: string[] = []
  const n = 1 + Math.floor(rnd() * 5)
  for (let k = 0; k < n; k++) try {
    const p = ws.projects[0]
    const where = pick(['row', 'row', 'flag', 'quote', 'quote', 'settings', 'supplier', 'project', 'submission', 'issue', 'decision', 'working', 'combo'])
    const v = structuredClone(pick(VALUES))
    if (where === 'combo') {
      const r = pick(p.rows) as any
      const sup = pick(ws.suppliers) as any
      r.status = pick(['selected', 'formalRequested', 'formalQuoted', 'quoting', 'quoted', 'submitted', 'ordered', 'received', 'cancelled'])
      r.adoptedSupplierId = pick([sup.id, 'S9', v])
      r.procurement = pick(['相見積', '指定商社', '客先指定品', '支給品', '社内在庫', v])
      r.designated = pick([sup.id, sup.name, 'S9', '', v])
      if (rnd() < 0.5) sup.tradable = false
      p.quotes.push({ rowId: r.id, supplierId: pick([sup.id, 'S9']), unitPrice: pick([100, null, v]), leadDays: pick([10, -1, null, 1e12, v]), moq: pick([1, null, 1e12, v]), formalRequestNo: pick(['FR-1', null, v]), formalPrice: pick([120, null, v]), formalLeadDays: pick([5, null, v]), stale: pick([false, true, v]) })
      done.push(`combo ${r.id} ${r.status} ${JSON.stringify(r.procurement)} adopted=${JSON.stringify(r.adoptedSupplierId)} tradable=${sup.tradable}`)
    } else if (where === 'row') {
      const r = pick(p.rows) as any
      const key = pick([...Object.keys(r), 'working', 'ordered', 'received', 'promisedDate', 'needDateFixed', 'needOffset', 'packQty', 'orderQty', 'status', 'replaces', 'replacedBy', 'hidden', 'receivedLot', 'altPolicy', 'makerLock', 'unit', 'qtyNeeded', 'publishedRev'])
      r[key] = v
      done.push(`rows[${r.id}].${key}=${JSON.stringify(v).slice(0, 60)}`)
    } else if (where === 'working') {
      const r = pick(p.rows) as any
      r.working = r.working && typeof r.working === 'object' ? r.working : {}
      const key = pick(['name', 'model', 'maker', 'qtyNeeded', 'needOffset', 'needDateFixed', 'unit', 'procurement', 'designated', 'altPolicy', 'category', 'ref', 'note'])
      r.working[key] = v
      done.push(`rows[${r.id}].working.${key}=${JSON.stringify(v).slice(0, 60)}`)
    } else if (where === 'flag') {
      const r = pick(p.rows) as any
      const key = pick(['requote', 'pmPending', 'pmReason', 'leadNG', 'early', 'formalWithdrawn', 'countermeasure', 'renegotiating', 'capRuled', 'reissue', 'delegated', 'formalDiffKey', 'ltbPending', 'contested', 'reconfirm', 'importMismatch', 'droppedStopped', 'surplusRejected', 'orderQtyCheck', 'formalDiff', 'altPending'])
      r.flags[key] = v
      done.push(`rows[${r.id}].flags.${key}=${JSON.stringify(v).slice(0, 60)}`)
    } else if (where === 'quote' && p.quotes.length) {
      const q = pick(p.quotes) as any
      const key = pick([...Object.keys(q), 'formalRequestNo', 'stale', 'staleModel', 'stock', 'leadDays', 'formalLeadDays', 'formalPrice', 'unitPrice', 'moq', 'quoteQty', 'answeredAt', 'validUntil', 'currency'])
      q[key] = v
      done.push(`quotes[${q.rowId}/${q.supplierId}].${key}=${JSON.stringify(v).slice(0, 60)}`)
    } else if (where === 'settings') {
      const key = pick([...Object.keys(p.settings), 'quoteDeadline', 'quoteCompleteRule', 'holidays', 'budget'])
      p.settings[key] = v
      done.push(`settings.${key}=${JSON.stringify(v).slice(0, 60)}`)
    } else if (where === 'supplier') {
      const s = pick(ws.suppliers) as any
      const key = pick([...Object.keys(s), 'tradable', 'handledMakers', 'id', 'name', 'color', 'terms'])
      s[key] = v
      done.push(`suppliers[${s.id}].${key}=${JSON.stringify(v).slice(0, 60)}`)
    } else if (where === 'project') {
      const key = pick(['supplierIds', 'preferredSupplierIds', 'members', 'rowWeights', 'requestRevs', 'dueDate', 'weights', 'caseDecisions', 'decisions', 'name', 'id', 'lastFormalSent'])
      p[key] = v
      done.push(`project.${key}=${JSON.stringify(v).slice(0, 60)}`)
    } else if (where === 'submission' && p.submissions?.length) {
      const s = pick(p.submissions) as any
      const key = pick([...Object.keys(s), 'changeSet', 'snapshot', 'causes', 'acked', 'rowIds', 'rev', 'by', 'at'])
      s[key] = v
      done.push(`submissions[${s.rev}].${key}=${JSON.stringify(v).slice(0, 60)}`)
    } else if (where === 'decision' && p.decisions?.length) {
      const d = pick(p.decisions) as any
      const key = pick([...Object.keys(d), 'payload', 'external', 'by', 'at', 'kind'])
      d[key] = v
      done.push(`decisions[${d.id}].${key}=${JSON.stringify(v).slice(0, 60)}`)
    } else if (where === 'issue' && p.issues.length) {
      const i = pick(p.issues) as any
      const key = pick([...Object.keys(i), 'kind', 'status', 'by', 'bounceCount', 'thread', 'rowId'])
      i[key] = v
      done.push(`issues[${i.id}].${key}=${JSON.stringify(v).slice(0, 60)}`)
    }
  } catch { /* 前の変異で形が変わった */ }
  return done
}

const N = Number(process.env.N ?? 3000)
if (process.env.DUMP) {
  // 画面で読む用（137-render-ui.mjs）: 変異させた（sanitize 前の）ワークスペースを書き出す
  const dump: unknown[] = []
  for (let t = 0; t < N; t++) { const ws = structuredClone(base); const muts = mutate(ws); if (sanitizeWorkspace(JSON.parse(JSON.stringify(ws))).ws) dump.push({ muts, ws }) }
  fs.writeFileSync(process.env.DUMP, JSON.stringify(dump))
  console.log('dumped', dump.length)
  process.exit(0)
}
const sig = new Map<string, { count: number; first: any }>()
let accepted = 0, rejected = 0, normFail = 0
const fail = (stage: string, e: unknown, muts: string[]) => {
  const msg = `${stage}: ${(e as Error).message}`.replace(/R\d{3}/g, 'Rxxx').slice(0, 200)
  const stack = ((e as Error).stack ?? '').split('\n').slice(1, 4).map((s) => s.trim()).join(' | ')
  const cur = sig.get(msg)
  if (cur) cur.count++
  else sig.set(msg, { count: 1, first: { muts, stack } })
}
for (let t = 0; t < N; t++) {
  const ws = structuredClone(base)
  const muts = mutate(ws)
  const res = sanitizeWorkspace(JSON.parse(JSON.stringify(ws)))
  if (!res.ws) { rejected++; continue }
  accepted++
  setSupplierMaster(res.ws.suppliers)
  for (const p of res.ws.projects) {
    try { normalize(p, res.ws) } catch (e) { normFail++; fail('normalize', e, muts); continue }
    for (const role of ['design', 'purchasing', 'pm'] as const) {
      const w = { ...res.ws, user: { ...res.ws.user, role } }
      let ctx: any
      try { ctx = sel.makeCtx(w, p, null); buildProblems(w, p) } catch (e) { fail('makeCtx/buildProblems', e, muts); continue }
      for (const v of VIEWS) {
        for (const r of p.rows) {
          try { v.filter(r, ctx) } catch (e) { fail(`view${v.id}.filter`, e, muts) }
        }
      }
      for (const r of p.rows) {
        for (const c of COLUMNS.filter((x) => !x.perSupplier)) {
          try { sel.cellText(r, c.key, ctx); sel.cellSev(r, c.key, ctx) } catch (e) { fail(`cell.${c.perSupplier ? 'perSupplier' : c.key}`, e, muts) }
        }
        for (const s of res.ws.suppliers) {
          for (const c of COLUMNS.filter((x) => x.perSupplier)) { const k = `${c.key}@${s.id}`; try { sel.cellText(r, k, ctx); sel.cellSev(r, k, ctx) } catch (e) { fail(`cell.${c.key}@S`, e, muts) } }
        }
        try { score.scoreRow(p, r, res.ws.suppliers); score.rankedQuotes(p, r, res.ws.suppliers); score.nextBest(p, r, res.ws.suppliers) } catch (e) { fail('score', e, muts) }
        try { der.ball(p, r); der.rowNeedDate(p, r); der.quoteComplete(p, r); der.surplusOf(p, r); der.lineAmount(p, r); der.overCap(p, r); der.designatedDeclined(p, r); der.orderQty(r); der.waitingDays(p, r) } catch (e) { fail('derive.row', e, muts) }
      }
      try { der.totals(p); der.ballCounts(p); der.designBreakdown(p); der.unpublishedCount(p, w.user.name); der.daysLeft(p) } catch (e) { fail('derive.project', e, muts) }
    }
    try { structuredClone(res.ws); JSON.stringify(res.ws) } catch (e) { fail('clone', e, muts) }
  }
}
const summary = { src: SRC, seed: Number(process.env.SEED ?? 18), N, accepted, rejected, normFail, distinctErrors: [...sig.entries()].map(([k, v]) => ({ error: k, count: v.count, example: v.first })) }
console.log(JSON.stringify(summary, null, 2).slice(0, 20000))
fs.writeFileSync('/home/user/BOM/usertest/veteran/r19/131-render-fuzz' + (process.env.TAG ?? '') + '.json', JSON.stringify(summary, null, 2))
