import type { Role, Row } from './types'
import { ALT_POLICIES, MAKER_LOCKS, PROCUREMENTS, UNITS } from './types'

export type ColKind = 'text' | 'num' | 'select' | 'date' | 'bool' | 'computed'

export interface ColumnDef {
  key: string
  label: string
  kind: ColKind
  width?: number
  /** 書ける役割（空=読み取り専用） */
  editableBy: Role[]
  options?: string[]
  /** 設計列（作業中コピーの対象） */
  design?: boolean
  /** 商社ごとの列（supplierId を付けて展開） */
  perSupplier?: boolean
  numeric?: boolean
}

export const COLUMNS: ColumnDef[] = [
  { key: 'id', label: 'ID', kind: 'computed', width: 56, editableBy: [] },
  { key: 'ball', label: 'ボール', kind: 'computed', width: 52, editableBy: [] },
  { key: 'ref', label: '回路記号', kind: 'text', width: 70, editableBy: ['design'], design: true },
  { key: 'drawing', label: '図面番号', kind: 'text', width: 110, editableBy: ['design'], design: true },
  { key: 'category', label: '分類', kind: 'text', width: 60, editableBy: ['design'], design: true },
  { key: 'name', label: '部品名', kind: 'text', width: 180, editableBy: ['design'], design: true },
  { key: 'model', label: '型式', kind: 'text', width: 190, editableBy: ['design'], design: true },
  { key: 'maker', label: 'メーカ', kind: 'text', width: 100, editableBy: ['design'], design: true },
  { key: 'qtyNeeded', label: '必要数', kind: 'num', width: 56, editableBy: ['design'], design: true, numeric: true },
  { key: 'unit', label: '単位', kind: 'select', width: 48, editableBy: ['design'], design: true, options: UNITS },
  { key: 'packQty', label: '入数', kind: 'num', width: 48, editableBy: ['design'], design: true, numeric: true },
  { key: 'procurement', label: '調達区分', kind: 'select', width: 76, editableBy: ['design'], design: true, options: PROCUREMENTS },
  { key: 'makerLock', label: 'メーカ指定', kind: 'select', width: 64, editableBy: ['design'], design: true, options: MAKER_LOCKS },
  { key: 'altPolicy', label: '代替可否', kind: 'select', width: 72, editableBy: ['design'], design: true, options: ALT_POLICIES },
  { key: 'designated', label: '指定先', kind: 'text', width: 110, editableBy: ['design'], design: true },
  { key: 'needOffset', label: '必要日(前倒し)', kind: 'num', width: 64, editableBy: ['design'], design: true, numeric: true },
  { key: 'needDateFixed', label: '必要日(固定)', kind: 'date', width: 72, editableBy: ['design'], design: true },
  { key: 'needDate', label: '必要日', kind: 'computed', width: 72, editableBy: [] },
  { key: 'tags', label: '規格', kind: 'text', width: 70, editableBy: ['design'], design: true },
  { key: 'orderQty', label: '発注数', kind: 'num', width: 56, editableBy: ['purchasing'], numeric: true },
  { key: 'adopted', label: '採用', kind: 'computed', width: 110, editableBy: [] },
  { key: 'score', label: 'スコア', kind: 'computed', width: 52, editableBy: [], numeric: true },
  { key: 'unitPrice', label: '単価', kind: 'computed', width: 70, editableBy: [], numeric: true },
  { key: 'amount', label: '金額', kind: 'computed', width: 86, editableBy: [], numeric: true },
  { key: 'formalPrice', label: '正式単価', kind: 'computed', width: 70, editableBy: [], numeric: true },
  { key: 'formalDiff', label: '差分', kind: 'computed', width: 56, editableBy: [], numeric: true },
  { key: 'lead', label: '納期', kind: 'computed', width: 56, editableBy: [], numeric: true },
  { key: 'status', label: '状態', kind: 'computed', width: 96, editableBy: [] },
  { key: 'due', label: '期限', kind: 'computed', width: 60, editableBy: [] },
  { key: 'waiting', label: '待ち', kind: 'computed', width: 40, editableBy: [], numeric: true },
  { key: 'ordered', label: '発注', kind: 'bool', width: 40, editableBy: ['purchasing'] },
  { key: 'received', label: '入荷', kind: 'bool', width: 40, editableBy: ['purchasing'] },
  { key: 'promisedDate', label: '入荷予定', kind: 'date', width: 72, editableBy: ['purchasing'] },
  { key: 'receivedLot', label: 'ロット', kind: 'text', width: 80, editableBy: ['purchasing'] },
  { key: 'extraCost', label: '追加費用', kind: 'num', width: 70, editableBy: ['purchasing'], numeric: true },
  { key: 'extraCostKind', label: '費用種別', kind: 'select', width: 60, editableBy: ['purchasing'], options: ['特急', '送料', '分納', 'その他'] },
  { key: 'note', label: '備考', kind: 'text', width: 160, editableBy: ['design'], design: true },
  // 商社ごとの列（6 商社別ビュー、9 購買作業ビュー）
  { key: 'q.unitPrice', label: '単価', kind: 'num', width: 70, editableBy: ['purchasing'], perSupplier: true, numeric: true },
  { key: 'q.leadDays', label: '納期', kind: 'num', width: 50, editableBy: ['purchasing'], perSupplier: true, numeric: true },
  { key: 'q.moq', label: 'MOQ', kind: 'num', width: 50, editableBy: ['purchasing'], perSupplier: true, numeric: true },
  { key: 'q.stock', label: '在庫', kind: 'select', width: 60, editableBy: ['purchasing'], perSupplier: true, options: ['在庫', '取寄', '受注生産'] },
  { key: 'q.validUntil', label: '有効期限', kind: 'date', width: 72, editableBy: ['purchasing'], perSupplier: true },
  { key: 'q.formalPrice', label: '正式単価', kind: 'num', width: 70, editableBy: ['purchasing'], perSupplier: true, numeric: true },
  { key: 'q.formalLeadDays', label: '正式納期', kind: 'num', width: 56, editableBy: ['purchasing'], perSupplier: true, numeric: true },
  { key: 'q.formalValidUntil', label: '正式期限', kind: 'date', width: 72, editableBy: ['purchasing'], perSupplier: true },
  { key: 'q.formalDiffReason', label: '差分理由', kind: 'text', width: 90, editableBy: ['purchasing'], perSupplier: true },
]

export const COL_BY_KEY = new Map(COLUMNS.map((c) => [c.key, c]))

export function colDef(key: string): ColumnDef | undefined {
  // 商社列は "q.unitPrice@S1" の形
  const base = key.includes('@') ? key.slice(0, key.indexOf('@')) : key
  return COL_BY_KEY.get(base)
}

export function supplierOfCol(key: string): string | undefined {
  return key.includes('@') ? key.slice(key.indexOf('@') + 1) : undefined
}

export function rowFieldOf(key: string): keyof Row | undefined {
  const d = colDef(key)
  if (!d || d.kind === 'computed' || d.perSupplier) return undefined
  return key as keyof Row
}
