import type { Project } from '@/model/types'

export interface SettingField {
  key: string
  label: string
  owner: 'PM' | '購買'
  value: string
  hint?: string
}

export function settingsFields(p: Project): SettingField[] {
  const s = p.settings
  const pct = (n: number) => String(Math.round(n * 1000) / 10)
  return [
    { key: 'name', label: '案件名', owner: 'PM', value: p.name },
    { key: 'dueDate', label: '案件納期', owner: 'PM', value: p.dueDate ?? '未定', hint: '2026-11-30 / 11/30 / 未定' },
    { key: 'processDays', label: '社内工程日数（この案件）', owner: 'PM', value: String(s.processDays), hint: '納期から逆算して必要日を出す日数' },
    { key: 'budget', label: '予算', owner: 'PM', value: s.budget == null ? '' : String(s.budget), hint: '例: 2800000 / 280万' },
    { key: 'weights', label: '重み（価格,納期,実績,条件）', owner: 'PM', value: `${p.weights.price},${p.weights.lead},${p.weights.record},${p.weights.terms}`, hint: '例: 40,30,20,10' },
    { key: 'selector', label: '選定者（設計 / 購買）', owner: 'PM', value: s.selector === 'purchasing' ? '購買' : '設計' },
    { key: 'changeNeedsPmApproval', label: '設計変更は PM 承認が必要', owner: 'PM', value: s.changeNeedsPmApproval ? 'はい' : 'いいえ' },
    { key: 'externalApprovalAmount', label: '上長決裁: 行の差額 ≥（円）', owner: 'PM', value: String(s.externalApprovalAmount) },
    { key: 'externalApprovalBudgetPct', label: '上長決裁: 予算比 +（%）', owner: 'PM', value: pct(s.externalApprovalBudgetPct) },
    { key: 'members', label: '担当者（設計,購買,PM）', owner: 'PM', value: `${p.members.design},${p.members.purchasing},${p.members.pm}` },
    { key: 'quoteDays', label: '回答期限の既定（日）', owner: '購買', value: String(s.quoteDays) },
    { key: 'quoteDeadline', label: '今回の回答期限', owner: '購買', value: s.quoteDeadline ?? '', hint: '2026-11-05 / 11/5' },
    { key: 'quoteCompleteRule', label: '見積完了条件（全社 / 2社以上 / 期限）', owner: '購買', value: s.quoteCompleteRule === 'all' ? '全社' : s.quoteCompleteRule === 'min2' ? '2社以上' : '期限' },
    { key: 'tieThreshold', label: '拮抗閾値（点）', owner: '購買', value: String(s.tieThreshold) },
    { key: 'exceptionAmount', label: '例外閾値（円）', owner: '購買', value: String(s.exceptionAmount) },
    { key: 'exceptionPct', label: '例外閾値（%）', owner: '購買', value: pct(s.exceptionPct) },
    { key: 'formalDiffPct', label: '正式見積の差分閾値（%）', owner: '購買', value: pct(s.formalDiffPct) },
    { key: 'formalDiffAmount', label: '正式見積の差分閾値（円）', owner: '購買', value: String(s.formalDiffAmount) },
    { key: 'qtyTolerancePct', label: '数量変更の許容（%）', owner: '購買', value: pct(s.qtyTolerancePct) },
    { key: 'formalDays', label: '正式見積の所要日数', owner: '購買', value: String(s.formalDays) },
    { key: 'currency', label: '通貨', owner: '購買', value: s.currency },
    { key: 'holidays', label: '休日（カンマ区切り）', owner: '購買', value: s.holidays.join(',') },
    { key: 'supplierIds', label: '相見積先（商社ID か名前、カンマ区切り）', owner: '購買', value: p.supplierIds.join(',') },
  ]
}
