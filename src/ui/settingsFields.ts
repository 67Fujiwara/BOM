import type { Project } from '@/model/types'

export interface SettingField {
  key: string
  label: string
  value: string
  hint?: string
}

export function settingsFields(p: Project): SettingField[] {
  const s = p.settings
  const pct = (n: number) => String(Math.round(n * 1000) / 10)
  return [
    { key: 'name', label: '案件名', value: p.name },
    { key: 'dueDate', label: '案件納期', value: p.dueDate ?? '未定', hint: '2026-11-30 / 11/30 / 未定' },
    { key: 'processDays', label: '社内工程日数（この案件）', value: String(s.processDays), hint: '納期から逆算して必要日を出す日数' },
    { key: 'budget', label: '予算', value: s.budget == null ? '' : String(s.budget), hint: '例: 2800000 / 280万' },
    { key: 'weights', label: '重み（価格,納期,実績,条件）', value: `${p.weights.price},${p.weights.lead},${p.weights.record},${p.weights.terms}`, hint: '例: 40,30,20,10' },
    { key: 'selector', label: '選定者（設計 / 購買）', value: s.selector === 'purchasing' ? '購買' : '設計' },
    { key: 'members', label: '担当者（設計,購買）', value: `${p.members.design},${p.members.purchasing}` },
    { key: 'quoteDays', label: '回答期限の既定（日）', value: String(s.quoteDays) },
    { key: 'quoteDeadline', label: '今回の回答期限', value: s.quoteDeadline ?? '', hint: '2026-11-05 / 11/5' },
    { key: 'quoteCompleteRule', label: '見積完了条件（全社 / 2社以上 / 期限）', value: s.quoteCompleteRule === 'all' ? '全社' : s.quoteCompleteRule === 'min2' ? '2社以上' : '期限' },
    { key: 'tieThreshold', label: '拮抗閾値（点）', value: String(s.tieThreshold) },
    { key: 'qtyTolerancePct', label: '数量変更の許容（%）', value: pct(s.qtyTolerancePct) },
    { key: 'formalDays', label: '正式見積の所要日数', value: String(s.formalDays) },
    { key: 'currency', label: '通貨', value: s.currency },
    { key: 'holidays', label: '休日（カンマ区切り）', value: s.holidays.join(',') },
    { key: 'supplierIds', label: '相見積先（商社ID か名前、カンマ区切り）', value: p.supplierIds.join(',') },
  ]
}
