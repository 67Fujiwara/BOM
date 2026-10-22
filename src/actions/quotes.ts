import { useStore } from '@/model/store'
import type { Project, Quote, Row } from '@/model/types'
import { effective, isActive, isQuotable, orderQty, rowNeedDate } from '@/model/derive'
import { normalize, setStatus } from '@/model/lifecycle'
import { emptyQuote } from '@/model/sample'
import { quoteTargets } from './rows'
import { addDays, todayStr } from '@/model/dates'

function st() {
  return useStore.getState()
}

/** 概算見積を依頼（購買）: 提出済の行 × 商社 → 依頼 Excel、状態を見積中に */
export async function requestRoughQuotes(supplierIds: string[], deadline: string): Promise<string> {
  const s = st()
  if (s.user().role !== 'purchasing') return '権限なし（概算見積の依頼は購買）'
  const p = s.project()
  const rows = p.rows.filter((r) => isActive(r) && isQuotable(r) && (r.status === 'submitted' || r.flags.requote) && !(r.working && Object.keys(r.working).length))
  if (!rows.length) return '依頼する行がありません（提出済・再見積要の行なし）'
  const excluded = p.rows.filter((r) => isActive(r) && r.status === 'submitted' && r.working && Object.keys(r.working).length).length
  const perSupplier = new Map<string, Row[]>()
  for (const r of rows) for (const sid of quoteTargets(p, r)) if (supplierIds.includes(sid)) perSupplier.set(sid, [...(perSupplier.get(sid) ?? []), r])
  s.commit(`概算見積を依頼（${[...perSupplier.keys()].map((id) => s.ws.suppliers.find((x) => x.id === id)?.name).join('・')}）`, (p2, ws) => {
    p2.settings.quoteDeadline = deadline
    for (const sid of supplierIds) if (!p2.supplierIds.includes(sid)) p2.supplierIds.push(sid)
    for (const r0 of rows) {
      const r = p2.rows.find((x) => x.id === r0.id)!
      for (const sid of quoteTargets(p2, r)) {
        if (!supplierIds.includes(sid)) continue
        if (!p2.quotes.some((q) => q.rowId === r.id && q.supplierId === sid && !q.stale)) p2.quotes.push(emptyQuote(r.id, sid))
      }
      r.flags.requote = false
      if (r.status === 'submitted') setStatus(r, 'quoting')
      else if (['quoted', 'selected', 'formalRequested', 'formalQuoted'].includes(r.status) && r0.flags.requote) setStatus(r, 'quoting')
    }
    for (const sid of perSupplier.keys()) p2.requestRevs[sid] = (p2.requestRevs[sid] ?? 0) + 1
    normalize(p2, ws)
  })
  const p2 = st().project()
  for (const [sid, rs] of perSupplier) {
    const sup = s.ws.suppliers.find((x) => x.id === sid)!
    await (await import('@/io/excel')).exportRequestExcel(p2, sup, rs.map((r) => p2.rows.find((x) => x.id === r.id)!), 'rough', deadline, p2.requestRevs[sid] ?? 1)
  }
  return `${rows.length} 行 × ${perSupplier.size} 社に依頼（回答期限 ${deadline}）${excluded ? `。作業中 ${excluded} 行を除外` : ''}`
}

export interface ImportResult {
  updated: number
  unmatched: string[]
  modelMismatch: string[]
  proposals: number
}

/** 見積回答の取り込み（タブ区切り。依頼 Excel と同じ列順） */
export function importQuoteAnswers(text: string, supplierId: string): ImportResult {
  const s = st()
  const res: ImportResult = { updated: 0, unmatched: [], modelMismatch: [], proposals: 0 }
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim())
  if (!lines.length) return res
  const header = lines[0].split('\t').map((h) => h.trim())
  const idx = (name: string) => header.findIndex((h) => h === name)
  const col = { id: idx('行ID') >= 0 ? idx('行ID') : idx('ID'), model: idx('型式'), price: idx('単価'), lead: idx('納期'), moq: idx('MOQ'), stock: idx('在庫区分'), qty: idx('見積数量'), valid: idx('有効期限'), altModel: idx('代替型式'), altMaker: idx('代替メーカ'), altPrice: idx('代替単価'), altLead: idx('代替納期') }
  const hasHeader = col.id >= 0 && col.price >= 0
  const body = hasHeader ? lines.slice(1) : lines
  const get = (cells: string[], i: number) => (i >= 0 && i < cells.length ? cells[i].trim() : '')
  s.commit(`見積回答を取り込む（${s.ws.suppliers.find((x) => x.id === supplierId)?.name}）`, (p, ws) => {
    for (const line of body) {
      const cells = line.split('\t')
      const id = hasHeader ? get(cells, col.id) : get(cells, 0)
      const r = p.rows.find((x) => x.id === id)
      if (!r) {
        res.unmatched.push(id || line.slice(0, 20))
        continue
      }
      const model = hasHeader ? get(cells, col.model) : get(cells, 1)
      if (model && model.replace(/\s/g, '') !== effective(r).model.replace(/\s/g, '')) res.modelMismatch.push(r.id)
      let q = p.quotes.find((x) => x.rowId === r.id && x.supplierId === supplierId && !x.stale)
      if (!q) {
        q = emptyQuote(r.id, supplierId)
        p.quotes.push(q)
      }
      const num = (v: string) => (v === '' ? null : v === '即納' ? 0 : /取扱なし|辞退/.test(v) ? -1 : Number(v.replace(/[,¥]/g, '')))
      const price = hasHeader ? get(cells, col.price) : get(cells, 2)
      const lead = hasHeader ? get(cells, col.lead) : get(cells, 3)
      const moq = hasHeader ? get(cells, col.moq) : get(cells, 4)
      q.unitPrice = num(price)
      q.leadDays = num(lead)
      q.moq = num(moq)
      const stock = hasHeader ? get(cells, col.stock) : get(cells, 5)
      q.stock = stock === '在庫' || stock === '取寄' || stock === '受注生産' ? stock : q.stock
      const qty = hasHeader ? get(cells, col.qty) : ''
      q.quoteQty = qty ? Number(qty) : orderQty(r)
      const valid = hasHeader ? get(cells, col.valid) : ''
      q.validUntil = valid || addDays(todayStr(), 30)
      q.source = '取込'
      res.updated++
      // 代替提案 → 指摘の下書き
      const altModel = hasHeader ? get(cells, col.altModel) : ''
      if (altModel) {
        const e = effective(r)
        if (e.altPolicy === '不可' || e.procurement === '客先指定品') {
          p.events.push({ id: (p.events.at(-1)?.id ?? 0) + 1, at: new Date().toISOString(), by: s.user(), rowId: r.id, text: `商社提案（対象外）: ${altModel}` })
        } else {
          p.issues.push({ id: 'I-' + String(p.nextIssueNo++).padStart(3, '0'), rowId: r.id, field: 'model', kind: '代替提案', text: `商社提案: ${altModel}`, proposal: { model: altModel, maker: get(cells, col.altMaker) || e.maker, supplierId, unitPrice: num(get(cells, col.altPrice)), leadDays: num(get(cells, col.altLead)) }, by: s.user(), at: new Date().toISOString(), status: 'draft', replies: [], bounceCount: 0, dueAt: addDays(todayStr(), 3) })
          res.proposals++
        }
      }
      if (r.status === 'submitted') setStatus(r, 'quoting')
    }
    normalize(p, ws)
  })
  return res
}

/** 正式見積を依頼（社外）: 選定済の行を商社ごとに */
export async function requestFormalQuotes(): Promise<string> {
  const s = st()
  if (s.user().role !== 'purchasing') return '権限なし（正式見積の依頼は購買）'
  const p = s.project()
  const target = p.rows.filter((r) => isActive(r) && r.adoptedSupplierId && (r.status === 'selected' || (r.flags.reissue && ['formalRequested', 'formalQuoted'].includes(r.status))))
  const working = target.filter((r) => r.working && Object.keys(r.working).length)
  const pending = target.filter((r) => r.flags.pmPending)
  const rows = target.filter((r) => !working.includes(r) && !pending.includes(r))
  if (!rows.length) return '依頼する行がありません（選定済・再発行対象なし）'
  const per = new Map<string, Row[]>()
  for (const r of rows) per.set(r.adoptedSupplierId!, [...(per.get(r.adoptedSupplierId!) ?? []), r])
  s.commit('正式見積を依頼（社外）', (p2, ws) => {
    for (const sid of per.keys()) p2.requestRevs['F' + sid] = (p2.requestRevs['F' + sid] ?? 0) + 1
    for (const r0 of rows) {
      const r = p2.rows.find((x) => x.id === r0.id)!
      const q = p2.quotes.find((x) => x.rowId === r.id && x.supplierId === r.adoptedSupplierId && !x.stale)
      if (q) q.formalRequestNo = `${p2.id}-${r.adoptedSupplierId}-F${p2.requestRevs['F' + r.adoptedSupplierId!]}`
      r.flags.reissue = false
      if (r.status === 'selected') setStatus(r, 'formalRequested')
      r.dueAt = addDays(todayStr(), p2.settings.formalDays)
    }
    normalize(p2, ws)
  })
  const p2 = st().project()
  for (const [sid, rs] of per) {
    const sup = s.ws.suppliers.find((x) => x.id === sid)!
    await (await import('@/io/excel')).exportRequestExcel(p2, sup, rs.map((r) => p2.rows.find((x) => x.id === r.id)!), 'formal', addDays(todayStr(), p2.settings.formalDays), p2.requestRevs['F' + sid] ?? 1)
  }
  return `${rows.length} 行 × ${per.size} 社に正式見積を依頼${working.length || pending.length ? `。除外: 作業中 ${working.length} 行 / 承認待ち ${pending.length} 行` : ''}`
}

export function quoteFor(p: Project, rowId: string, supplierId: string): Quote | undefined {
  return p.quotes.find((q) => q.rowId === rowId && q.supplierId === supplierId && !q.stale)
}

export function needDateOf(p: Project, r: Row) {
  return rowNeedDate(p, r)
}
