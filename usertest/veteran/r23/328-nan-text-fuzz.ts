// ラウンド23: 131-render-fuzz を、例外でなく 'NaN'/'undefined'/'[object'/'Infinity' が画面の文（cellText）やスコアに出るかに変えたもの（変異 1 つ）。元: 120-normalize-fuzz の続き。sanitize を通り、起動時の normalize も通ったデータで、画面を描くときに呼ぶ関数
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
  const n = Number(process.env.MUTN ?? 1)
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


const N = Number(process.env.N ?? 6000)
const BAD = /NaN|undefined|\[object|Infinity/
const agg = new Map<string, { n: number; first: string; where: string }>()
let accepted = 0
for (let t = 0; t < N; t++) {
  const ws = structuredClone(base)
  const muts = mutate(ws)
  const res = sanitizeWorkspace(JSON.parse(JSON.stringify(ws)))
  if (!res.ws) continue
  accepted++
  setSupplierMaster(res.ws.suppliers)
  const p = res.ws.projects[0]
  try { normalize(p, res.ws) } catch { continue }
  const hits = new Set<string>()
  for (const role of ['design', 'purchasing', 'pm'] as const) {
    const w = { ...res.ws, user: { ...res.ws.user, role } }
    let ctx: any
    try { ctx = sel.makeCtx(w, p, null) } catch { continue }
    for (const r of p.rows) {
      for (const c of COLUMNS.filter((x) => !x.perSupplier)) { try { const tx = sel.cellText(r, c.key, ctx); if (BAD.test(String(tx.text))) hits.add(`cell:${c.key}`) } catch { /* 例外は 131 */ } }
      for (const s of res.ws.suppliers) for (const c of COLUMNS.filter((x) => x.perSupplier)) { try { const tx = sel.cellText(r, `${c.key}@${s.id}`, ctx); if (BAD.test(String(tx.text))) hits.add(`cell:${c.key}@S`) } catch { /* */ } }
      try { const sc = score.scoreRow(p, r, res.ws.suppliers); if (BAD.test(JSON.stringify(sc))) hits.add('scoreRow') } catch { /* */ }
      try { const rk = score.rankedQuotes(p, r, res.ws.suppliers); if (BAD.test(JSON.stringify(rk))) hits.add('rankedQuotes') } catch { /* */ }
    }
  }
  if (hits.size) {
    const sig = muts.map((m) => m.replace(/R\d{3}/g, 'Rxxx').replace(/\[S\d\]/g, '[S]').replace(/=.*/, '')).join(' & ')
    const key = sig + ' -> ' + [...hits].sort().join(',')
    const cur = agg.get(key)
    if (cur) cur.n++
    else agg.set(key, { n: 1, first: muts.join(' | ').slice(0, 160), where: [...hits].join(',') })
  }
}
console.log('accepted', accepted, 'distinct bad signatures', agg.size)
for (const [k, v] of [...agg.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 60)) console.log(v.n, k, ' e.g. ', v.first)
fs.writeFileSync('/home/user/BOM/usertest/veteran/r23/328-nan-text-fuzz' + (process.env.TAG ?? '') + '.json', JSON.stringify([...agg.entries()], null, 1))
