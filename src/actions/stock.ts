import { useStore } from '@/model/store'
import type { Project, Role, StockItem, Unit, Workspace } from '@/model/types'
import { UNITS } from '@/model/types'
import { adoptedQuote, isActive, normalizeModel } from '@/model/derive'
import { newProject, newRow } from '@/model/sample'
import { nextRowId } from '@/model/lifecycle'
import { parseBomPaste } from '@/io/paste'
import { parseNumber, toHalf } from '@/model/parse'
import { todayStr } from '@/model/dates'
import type { PanelStudioBom } from '@/io/panelStudio'

const st = () => useStore.getState()

// ---------- 案件番号 ----------

/** 案件番号（例: A123456）: 英字 1〜3 文字＋数字 3〜10 桁。大文字にそろえる */
export function parseProjectNo(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const v = toHalf(raw).replace(/[\s　]/g, '').toUpperCase()
  if (!v) return { ok: false, error: '案件番号を入れてください（例: A123456）' }
  if (!/^[A-Z]{1,3}\d{3,10}$/.test(v)) return { ok: false, error: `案件番号は「英字＋数字」で入れてください（例: A123456）。入力: 「${raw}」` }
  return { ok: true, value: v }
}

/** 新しい案件を登録する。成功したら null、失敗したら理由 */
export function createProject(no: string, customer: string, deviceName: string): { error: string } | { id: string } {
  const n = parseProjectNo(no)
  if (!n.ok) return { error: n.error }
  const cust = customer.trim()
  const dev = deviceName.trim()
  if (!cust) return { error: '客先を入れてください' }
  if (!dev) return { error: '装置名を入れてください' }
  const ws = st().ws
  if (ws.projects.some((p) => p.id.toUpperCase() === n.value)) return { error: `案件番号 ${n.value} はすでに登録されています` }
  const ok = st().commitWs('', (w) => {
    w.projects.push(buildProject(n.value, cust, dev, w.user.name, w.user.role))
  })
  return ok ? { id: n.value } : { error: '保存できませんでした（保存領域がいっぱいです）' }
}

function buildProject(id: string, customer: string, deviceName: string, userName: string, role: Role): Project {
  const p = newProject(id, deviceName, { customer })
  p.members = { design: role === 'design' ? userName : '', purchasing: role === 'purchasing' ? userName : '' }
  p.events[0] = { ...p.events[0], by: { name: userName, role }, text: `案件を登録（${customer} ${deviceName}）` }
  return p
}

export function setProjectCompleted(id: string, completed: boolean) {
  st().commitWs('', (w) => {
    const p = w.projects.find((x) => x.id === id)
    if (!p) return
    p.completed = completed
    p.completedAt = completed ? new Date().toISOString() : undefined
    p.updatedAt = new Date().toISOString()
    p.events.push({ id: (p.events.at(-1)?.id ?? 0) + 1, at: p.updatedAt, by: w.user, text: completed ? '完了案件にした' : '作成中に戻した' })
  })
  st().toastMsg(completed ? `${id} を完了案件にしました` : `${id} を作成中に戻しました`, 'ok')
}

export function deleteProject(id: string) {
  const ok = st().commitWs('', (w) => {
    w.projects = w.projects.filter((p) => p.id !== id)
    if (w.currentProjectId === id) w.currentProjectId = w.projects[0]?.id ?? ''
  })
  if (ok) st().toastMsg(`${id} を削除しました`, 'ok')
}

// ---------- 在庫 ----------

let seq = 0
const newId = (prefix: string, existing: string[]) => {
  let n = existing.length + 1 + seq++
  let id = `${prefix}${String(n).padStart(4, '0')}`
  while (existing.includes(id)) id = `${prefix}${String(++n).padStart(4, '0')}`
  return id
}

export interface StockInput {
  name: string
  model: string
  maker: string
  qty: string
  unit: string
  location: string
  note: string
}

function readStock(i: StockInput): { error: string } | { value: Omit<StockItem, 'id'> } {
  const name = i.name.trim()
  if (!name && !i.model.trim()) return { error: '部品名か型式を入れてください' }
  const q = parseNumber(i.qty || '0', { min: 0, max: 1e9, label: '在庫数' })
  if (!q.ok) return { error: q.error }
  const unit = (UNITS as string[]).includes(i.unit) ? (i.unit as Unit) : '個'
  return { value: { name, model: i.model.trim(), maker: i.maker.trim(), qty: q.value ?? 0, unit, location: i.location.trim(), note: i.note.trim() } }
}

export function addStock(i: StockInput): string | null {
  const r = readStock(i)
  if ('error' in r) return r.error
  st().commitWs('', (w) => {
    w.stock.push({ id: newId('ST', w.stock.map((x) => x.id)), ...r.value })
  })
  return null
}

export function updateStock(id: string, i: StockInput): string | null {
  const r = readStock(i)
  if ('error' in r) return r.error
  st().commitWs('', (w) => {
    const s = w.stock.find((x) => x.id === id)
    if (s) Object.assign(s, r.value)
  })
  return null
}

export function deleteStock(id: string) {
  st().commitWs('', (w) => {
    w.stock = w.stock.filter((x) => x.id !== id)
  })
}

/** Excel などから貼り付けた表（部品名・型式・メーカー・数量・単位）を在庫に足す。同じ型式・メーカーは数量を足す */
export function importStock(text: string): string {
  const res = parseBomPaste(text)
  const rows = res.rows.filter((r) => (r.name ?? '').trim() || (r.model ?? '').trim())
  if (!rows.length) return '取り込める行がありません（1 行目に「部品名・型式・メーカー・数量」の見出しがあると確実です）'
  let added = 0
  let merged = 0
  st().commitWs('', (w) => {
    for (const r of rows) {
      const key = normalizeModel(r.model ?? '') + '|' + (r.maker ?? '').trim().toLowerCase()
      const same = (r.model ?? '').trim() ? w.stock.find((x) => normalizeModel(x.model) + '|' + x.maker.trim().toLowerCase() === key) : undefined
      if (same) {
        same.qty += r.qtyNeeded ?? 0
        merged++
      } else {
        w.stock.push({ id: newId('ST', w.stock.map((x) => x.id)), name: (r.name ?? '').trim(), model: (r.model ?? '').trim(), maker: (r.maker ?? '').trim(), qty: r.qtyNeeded ?? 0, unit: r.unit ?? '個', location: '', note: (r.note ?? '').trim() })
        added++
      }
    }
  })
  return `${added} 件を追加${merged ? `、${merged} 件は同じ型式・メーカーなので数量を足しました` : ''}${res.warnings.length ? `（注意: ${res.warnings[0]}）` : ''}`
}

/** 作成中の案件に引き当てている数（取消・置換した行は数えない） */
export function allocatedOf(ws: Workspace, stockId: string): number {
  let n = 0
  for (const p of ws.projects) if (!p.completed) for (const r of p.rows) if (r.stockId === stockId && isActive(r)) n += r.qtyNeeded
  return n
}

// ---------- 購入歴 ----------

export interface PurchaseEntry {
  key: string
  name: string
  model: string
  maker: string
  unit: Unit
  lastPrice: number | null
  lastSupplier: string
  lastDate: string
  totalQty: number
  count: number
  projects: string[]
  /** 手で取り込んだ分の ID（削除できる） */
  recordIds: string[]
}

const keyOf = (model: string, maker: string, name: string) => (model.trim() ? normalizeModel(model) + '|' + maker.trim().toLowerCase() : 'N|' + name.trim().toLowerCase())

/** 購入歴: 発注した行（全案件）＋取り込んだ分を、型式・メーカーごとにまとめる。新しい購入が先 */
export function purchaseHistory(ws: Workspace): PurchaseEntry[] {
  const map = new Map<string, PurchaseEntry>()
  const add = (name: string, model: string, maker: string, unit: Unit, price: number | null, supplier: string, date: string, qty: number | null, project: string | null, recordId: string | null) => {
    const key = keyOf(model, maker, name)
    let e = map.get(key)
    if (!e) {
      e = { key, name, model, maker, unit, lastPrice: null, lastSupplier: '', lastDate: '', totalQty: 0, count: 0, projects: [], recordIds: [] }
      map.set(key, e)
    }
    e.count++
    e.totalQty += qty ?? 0
    if (project && !e.projects.includes(project)) e.projects.push(project)
    if (recordId) e.recordIds.push(recordId)
    if (!e.name && name) e.name = name
    // 最後の購入（日付が新しいほう。日付が無いものは古い扱い）の単価・商社
    if (date >= e.lastDate && (price != null || supplier || date)) {
      e.lastDate = date || e.lastDate
      if (price != null) e.lastPrice = price
      if (supplier) e.lastSupplier = supplier
    }
  }
  for (const p of ws.projects)
    for (const r of p.rows) {
      if (!(r.ordered || r.status === 'ordered' || r.status === 'received') || !isActive(r)) continue
      const q = adoptedQuote(p, r)
      const price = q?.formalPrice ?? q?.unitPrice ?? null
      const sup = ws.suppliers.find((s) => s.id === r.adoptedSupplierId)?.name ?? ''
      add(r.name, r.model, r.maker, r.unit, price, sup, r.orderedAt?.slice(0, 10) ?? p.updatedAt.slice(0, 10), r.orderQty ?? r.qtyNeeded, p.id, null)
    }
  for (const h of ws.purchases) add(h.name, h.model, h.maker, h.unit, h.unitPrice, h.supplier, h.date, h.qty, null, h.id)
  return [...map.values()].sort((a, b) => b.lastDate.localeCompare(a.lastDate) || a.name.localeCompare(b.name, 'ja'))
}

/** Excel などから貼り付けた表（部品名・型式・メーカー・数量）を購入歴に足す */
export function importPurchases(text: string, supplier: string, date: string): string {
  const res = parseBomPaste(text)
  const rows = res.rows.filter((r) => (r.name ?? '').trim() || (r.model ?? '').trim())
  if (!rows.length) return '取り込める行がありません（1 行目に「部品名・型式・メーカー・数量」の見出しがあると確実です）'
  const d = date.trim() ? toHalf(date).trim() : todayStr()
  st().commitWs('', (w) => {
    for (const r of rows) w.purchases.push({ id: newId('PH', w.purchases.map((x) => x.id)), name: (r.name ?? '').trim(), model: (r.model ?? '').trim(), maker: (r.maker ?? '').trim(), unit: r.unit ?? '個', unitPrice: null, supplier: supplier.trim(), date: /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : '', qty: r.qtyNeeded ?? null, note: (r.note ?? '').trim() })
  })
  return `${rows.length} 件を購入歴に取り込みました`
}

export interface PurchaseInput {
  name: string
  model: string
  maker: string
  unitPrice: string
  supplier: string
  date: string
}

export function addPurchase(i: PurchaseInput): string | null {
  if (!i.name.trim() && !i.model.trim()) return '部品名か型式を入れてください'
  const price = i.unitPrice.trim() ? parseNumber(i.unitPrice, { min: 0, max: 1e9, label: '単価' }) : null
  if (price && !price.ok) return price.error
  const d = i.date.trim() ? toHalf(i.date).trim().replace(/\//g, '-') : todayStr()
  if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(d)) return '購入日は 2026-05-12 のように入れてください'
  const [y, m, dd] = d.split('-')
  const date = `${y}-${m.padStart(2, '0')}-${dd.padStart(2, '0')}`
  st().commitWs('', (w) => {
    w.purchases.push({ id: newId('PH', w.purchases.map((x) => x.id)), name: i.name.trim(), model: i.model.trim(), maker: i.maker.trim(), unit: '個', unitPrice: price?.ok ? price.value : null, supplier: i.supplier.trim(), date, qty: null, note: '' })
  })
  return null
}

export function deletePurchaseRecords(ids: string[]) {
  st().commitWs('', (w) => {
    w.purchases = w.purchases.filter((x) => !ids.includes(x.id))
  })
}

// ---------- 作成中の案件へ追加 ----------

export type AddSource = { kind: 'stock'; id: string } | { kind: 'history'; entry: PurchaseEntry }

/** 部品を数量つきで、作成中の案件の部品表（下書きの行）に足す。失敗したら理由 */
export function addPartToProject(src: AddSource, qtyText: string, projectId: string): { error: string } | { rowId: string; projectId: string } {
  const q = parseNumber(qtyText, { min: 0.0001, max: 1e9, label: '数量' })
  if (!q.ok || q.value == null) return { error: q.ok ? '数量を入れてください' : q.error }
  const qty = q.value
  const ws = st().ws
  const target = ws.projects.find((p) => p.id === projectId)
  if (!target) return { error: '案件を選んでください' }
  if (target.completed) return { error: `${projectId} は完了案件です。作成中の案件を選んでください` }
  let rowId = ''
  let label = ''
  if (src.kind === 'stock') if (!ws.stock.some((s) => s.id === src.id)) return { error: '在庫が見つかりません' }
  const ok = st().commitWs('', (w) => {
    const p = w.projects.find((x) => x.id === projectId)!
    rowId = nextRowId(p)
    if (src.kind === 'stock') {
      const s = w.stock.find((x) => x.id === src.id)!
      label = [s.name, s.model].filter(Boolean).join(' ')
      p.rows.push(newRow(rowId, { name: s.name, model: s.model, maker: s.maker, qtyNeeded: qty, unit: s.unit, procurement: '社内在庫', note: `在庫から${s.location ? `（${s.location}）` : ''}`, stockId: s.id }))
    } else {
      const e = src.entry
      label = [e.name, e.model].filter(Boolean).join(' ')
      const prev = [e.lastPrice != null ? `¥${e.lastPrice.toLocaleString()}` : '', e.lastSupplier, e.lastDate].filter(Boolean).join(' ')
      p.rows.push(newRow(rowId, { name: e.name, model: e.model, maker: e.maker, qtyNeeded: qty, unit: e.unit, procurement: '相見積', note: prev ? `前回購入 ${prev}` : '購入歴から', historyKey: e.key }))
    }
    p.updatedAt = new Date().toISOString()
    p.version++
    p.events.push({ id: (p.events.at(-1)?.id ?? 0) + 1, at: p.updatedAt, by: w.user, rowId, text: `${label} × ${qty} を${src.kind === 'stock' ? '在庫' : '購入歴'}から追加` })
  })
  if (!ok) return { error: '保存できませんでした（保存領域がいっぱいです）' }
  return { rowId, projectId }
}

// ---------- Panel Studio（設計完了の部品表） ----------

/** 同じ案件番号がすでにあるか（あれば取り込みは追加になる）。完了案件なら null */
export function panelStudioTarget(no: string): { exists: boolean; completed: boolean } {
  const n = parseProjectNo(no)
  if (!n.ok) return { exists: false, completed: false }
  const p = st().ws.projects.find((x) => x.id.toUpperCase() === n.value)
  return { exists: !!p, completed: !!p?.completed }
}

/**
 * Panel Studio の設計完了の部品表から案件を作り、部品の行（下書き）を入れる。
 * 同じ案件番号がすでにあれば、その案件に足す（同じメーカー・型式の行は飛ばす）。
 */
export function importPanelStudio(data: PanelStudioBom, no: string, customer: string, device: string): { error: string } | { id: string; added: number; skipped: number; created: boolean } {
  const n = parseProjectNo(no)
  if (!n.ok) return { error: n.error }
  const cust = customer.trim()
  const dev = device.trim()
  const ws = st().ws
  const existing = ws.projects.find((p) => p.id.toUpperCase() === n.value)
  if (existing?.completed) return { error: `${n.value} は完了案件です。作成中に戻すか、別の案件番号にしてください` }
  if (!existing && !cust) return { error: '客先を入れてください' }
  if (!existing && !dev) return { error: '装置名を入れてください' }
  let added = 0
  let skipped = 0
  const ok = st().commitWs('', (w) => {
    let p = w.projects.find((x) => x.id.toUpperCase() === n.value)
    if (!p) {
      p = buildProject(n.value, cust, dev, w.user.name, w.user.role)
      w.projects.push(p)
    }
    const keyOf = (model: string, maker: string) => `${normalizeModel(model)}|${maker.trim()}`
    const have = new Set(p.rows.filter((r) => isActive(r)).map((r) => keyOf(r.model, r.maker)))
    for (const l of data.lines) {
      const k = keyOf(l.model, l.maker)
      if (l.model && have.has(k)) {
        skipped++
        continue
      }
      have.add(k)
      p.rows.push(newRow(nextRowId(p), { name: l.name, model: l.model, maker: l.maker, qtyNeeded: l.qty, unit: l.unit, procurement: '相見積', note: l.derived ? 'Panel Studio（派生部品）' : 'Panel Studio' }))
      added++
    }
    p.updatedAt = new Date().toISOString()
    p.version++
    p.events.push({ id: (p.events.at(-1)?.id ?? 0) + 1, at: p.updatedAt, by: w.user, text: `Panel Studio の設計完了から ${added} 行を取り込み${skipped ? `（同じ型式 ${skipped} 行は飛ばした）` : ''}` })
  })
  if (!ok) return { error: '保存できませんでした（保存領域がいっぱいです）' }
  return { id: n.value, added, skipped: skipped + data.skipped, created: !existing }
}
