export function todayStr(now = new Date()): string {
  return toStr(now)
}
export function toStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}
export function parse(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}
export function addDays(s: string, n: number): string {
  const d = parse(s)
  d.setDate(d.getDate() + n)
  return toStr(d)
}
export function diffDays(a: string, b: string): number {
  return Math.round((parse(a).getTime() - parse(b).getTime()) / 86400000)
}
export function isHoliday(s: string, holidays: string[] = []): boolean {
  const d = parse(s).getDay()
  return d === 0 || d === 6 || holidays.includes(s)
}
/** 営業日を n 日進める */
export function addBusinessDays(s: string, n: number, holidays: string[] = []): string {
  let cur = s
  let left = n
  while (left > 0) {
    cur = addDays(cur, 1)
    if (!isHoliday(cur, holidays)) left--
  }
  return cur
}
export function businessDaysBetween(from: string, to: string, holidays: string[] = []): number {
  if (to <= from) return 0
  let n = 0
  let cur = from
  while (cur < to) {
    cur = addDays(cur, 1)
    if (!isHoliday(cur, holidays)) n++
  }
  return n
}
export function fmtDate(s?: string | null): string {
  if (!s) return ''
  return s.slice(5).replace('-', '/')
}
export function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
