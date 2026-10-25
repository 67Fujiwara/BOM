// ラウンド17: 起動時・JSON の読み込み時に足された normalize（ラウンド16 の M16-03）を、壊れた／意地の悪い JSON で。
// sanitizeWorkspace を通った（＝起動時に読まれる・JSON の読み込みで受け付ける）データで normalize が例外を出すか。
// 起動時の normalize は store.ts のモジュールの頭で try/catch なしに呼ばれる（例外 → 画面が出ない）。
// vite-node で現行（/home/user/BOM/src）と r16 ビルド（SRC=scratchpad の bd8881e）の両方を直接呼ぶ。
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { sanitizeWorkspace } = await import(SRC + '/model/validate.ts')
const { normalize } = await import(SRC + '/model/lifecycle.ts')
const { makeWorkspace } = await import(SRC + '/model/sample.ts')
const { setSupplierMaster, checkRow } = await import(SRC + '/model/rules.ts')
import fs from 'node:fs'

const base = JSON.parse(JSON.stringify(makeWorkspace()))
const VALUES: unknown[] = [null, 0, -1, 1e308, -1e308, 'abc', '', {}, [], [1], { a: 1 }, true, false, '__proto__', '2026-02-30', 'NaN', '-1', '1,000', 1e12, 1e13, -1e12, 'R001', 'S1', 'S2', '在庫', 'formalRequested', 'selected', ['S1', 5], 12.5, '9999-12-31', '0000-01-01', '2026-10-23T25:61:00']
// 乱数（再現できるように種を固定）
let seed = Number(process.env.SEED ?? 17)
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)]

function mutate(ws: any): string[] {
  const done: string[] = []
  const n = 1 + Math.floor(rnd() * 4)
  for (let k = 0; k < n; k++) {
    const p = ws.projects[0]
    const where = pick(['row', 'flag', 'quote', 'settings', 'supplier', 'project', 'submission', 'issue', 'combo', 'combo'])
    if (where === 'combo') {
      // 採用・正式依頼・取引停止・指定先の組（normalize の採用を外す・取下げの印を足す道を通す）
      const r = pick(p.rows) as any
      const sup = pick(ws.suppliers) as any
      r.status = pick(['selected', 'formalRequested', 'formalQuoted', 'quoting', 'quoted', 'submitted'])
      r.adoptedSupplierId = sup.id
      r.publishedRev = pick([1, 2, null])
      r.procurement = pick(['相見積', '指定商社', '客先指定品', '支給品'])
      r.designated = pick([sup.id, sup.name, 'S9', ''])
      if (rnd() < 0.7) sup.tradable = false
      p.quotes = p.quotes.filter((q: any) => !(q.rowId === r.id && q.supplierId === sup.id))
      p.quotes.push({ rowId: r.id, supplierId: sup.id, unitPrice: pick([100, null]), leadDays: pick([10, -1, null, 1e12]), moq: pick([1, null, 1e12]), formalRequestNo: pick(['FR-1', 5, {}, null]), formalPrice: pick([120, null]), stale: false })
      const fv = structuredClone(pick(VALUES))
      // 取下げの印（ラウンド16 で足していく形に）以外の印も、ときどき文字・数以外に
      const fk = rnd() < 0.5 ? 'formalWithdrawn' : pick(['pmReason', 'countermeasure', 'formalDiffKey', 'pmPending', 'delegated', 'early', 'renegotiating'])
      r.flags[fk] = fv
      if (rnd() < 0.3) r.quoteTargets = structuredClone(pick(VALUES))
      done.push(`combo ${r.id} ${r.status} ${r.procurement} adopted=${sup.id} tradable=${sup.tradable} designated=${r.designated} ${fk}=${JSON.stringify(fv)}`)
      continue
    }
    const v = structuredClone(pick(VALUES))
    if (where === 'row') {
      const r = pick(p.rows) as any
      const key = pick([...Object.keys(r), 'working', 'adoptedSupplierId', 'designated', 'procurement', 'ordered', 'received', 'promisedDate', 'needDateFixed', 'needOffset', 'packQty', 'orderQty', 'status', 'replaces', 'replacedBy'])
      r[key] = v
      done.push(`rows[${r.id}].${key}=${JSON.stringify(v)}`)
    } else if (where === 'flag') {
      const r = pick(p.rows) as any
      const key = pick(['requote', 'pmPending', 'pmReason', 'leadNG', 'early', 'formalWithdrawn', 'countermeasure', 'renegotiating', 'capRuled', 'reissue', 'delegated', 'formalDiffKey', 'ltbPending', 'contested', 'reconfirm'])
      r.flags[key] = v
      done.push(`rows[${r.id}].flags.${key}=${JSON.stringify(v)}`)
    } else if (where === 'quote' && p.quotes.length) {
      const q = pick(p.quotes) as any
      const key = pick([...Object.keys(q), 'formalRequestNo', 'stale', 'staleModel', 'stock', 'leadDays', 'formalLeadDays', 'formalPrice', 'unitPrice'])
      q[key] = v
      done.push(`quotes[${q.rowId}/${q.supplierId}].${key}=${JSON.stringify(v)}`)
    } else if (where === 'settings') {
      const key = pick([...Object.keys(p.settings), 'quoteDeadline', 'quoteCompleteRule', 'holidays'])
      p.settings[key] = v
      done.push(`settings.${key}=${JSON.stringify(v)}`)
    } else if (where === 'supplier') {
      const s = pick(ws.suppliers) as any
      const key = pick([...Object.keys(s), 'tradable', 'handledMakers', 'id', 'name'])
      s[key] = v
      done.push(`suppliers[${s.id}].${key}=${JSON.stringify(v)}`)
    } else if (where === 'project') {
      const key = pick(['supplierIds', 'preferredSupplierIds', 'members', 'rowWeights', 'requestRevs', 'dueDate', 'weights', 'caseDecisions', 'decisions'])
      p[key] = v
      done.push(`project.${key}=${JSON.stringify(v)}`)
    } else if (where === 'submission' && p.submissions?.length) {
      const s = pick(p.submissions) as any
      const key = pick([...Object.keys(s), 'changeSet', 'snapshot', 'causes'])
      s[key] = v
      done.push(`submissions[${s.rev}].${key}=${JSON.stringify(v)}`)
    } else if (where === 'issue' && p.issues.length) {
      const i = pick(p.issues) as any
      const key = pick([...Object.keys(i), 'kind', 'status', 'by'])
      i[key] = v
      done.push(`issues[${i.id}].${key}=${JSON.stringify(v)}`)
    }
  }
  return done
}

const N = Number(process.env.N ?? 4000)
const out: any[] = []
const sig = new Map<string, { count: number; first: any }>()
let accepted = 0, rejected = 0
for (let t = 0; t < N; t++) {
  const ws = structuredClone(base)
  const muts = mutate(ws)
  const res = sanitizeWorkspace(JSON.parse(JSON.stringify(ws)))
  if (!res.ws) { rejected++; continue }
  accepted++
  setSupplierMaster(res.ws.suppliers)
  for (const p of res.ws.projects) {
    for (const stage of ['normalize', 'checkRow']) {
      try {
        if (stage === 'normalize') normalize(p, res.ws)
        else for (const r of p.rows) checkRow(r, res.ws.rules, p)
      } catch (e) {
        const msg = `${stage}: ${(e as Error).message}`
        const stack = ((e as Error).stack ?? '').split('\n').slice(1, 3).map((s) => s.trim()).join(' | ')
        const key = msg.replace(/R\d{3}/g, 'Rxxx')
        const cur = sig.get(key)
        if (cur) cur.count++
        else sig.set(key, { count: 1, first: { muts, stack, warnings: res.warnings } })
      }
    }
  }
}
const summary = { src: SRC, N, accepted, rejected, distinctErrors: [...sig.entries()].map(([k, v]) => ({ error: k, count: v.count, example: v.first })) }
console.log(JSON.stringify(summary, null, 2))
fs.writeFileSync('/home/user/BOM/usertest/veteran/r18/120-normalize-fuzz' + (process.env.TAG ?? '') + '.json', JSON.stringify(summary, null, 2))
