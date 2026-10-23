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
/** 休日の一覧ごとに、引きやすい形（集合と、平日の休日を並べたもの）を作って持っておく */
const holidayCache = new WeakMap<string[], { set: Set<string>; weekday: string[] }>()
function holidayIndex(holidays: string[]) {
  let c = holidayCache.get(holidays)
  if (!c) {
    const set = new Set(holidays)
    const weekday = [...set].filter((h) => /^\d{4}-\d{2}-\d{2}$/.test(h) && parse(h).getDay() % 6 !== 0).sort()
    c = { set, weekday }
    holidayCache.set(holidays, c)
  }
  return c
}
export function isHoliday(s: string, holidays: string[] = []): boolean {
  const d = parse(s).getDay()
  return d === 0 || d === 6 || holidayIndex(holidays).set.has(s)
}
/** 営業日を n 日進める */
export function addBusinessDays(s: string, n: number, holidays: string[] = []): string {
  // 日付の文字を毎日作り直さず、Date を 1 つ進める（休日の一覧があるときだけ文字にして引く）
  const set = holidayIndex(holidays).set
  const d = parse(s)
  if (Number.isNaN(d.getTime())) return s
  let left = Math.min(Math.max(0, Math.floor(n)), 3650)
  while (left > 0) {
    d.setDate(d.getDate() + 1)
    const w = d.getDay()
    if (w !== 0 && w !== 6 && (set.size === 0 || !set.has(toStr(d)))) left--
  }
  return toStr(d)
}
/** from の翌日から to までの営業日の数（1 日ずつ数えず、週の数と休日の一覧の二分探索で出す） */
export function businessDaysBetween(from: string, to: string, holidays: string[] = []): number {
  if (to <= from) return 0
  const total = diffDays(to, from)
  if (!Number.isFinite(total) || total <= 0) return 0
  let n = Math.floor(total / 7) * 5
  const startDow = parse(from).getDay()
  for (let i = 1; i <= total % 7; i++) {
    const dow = (startDow + i) % 7
    if (dow !== 0 && dow !== 6) n++
  }
  const wk = holidayIndex(holidays).weekday
  const upper = (x: string) => {
    let lo = 0
    let hi = wk.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (wk[mid] <= x) lo = mid + 1
      else hi = mid
    }
    return lo
  }
  return n - (upper(to.slice(0, 10)) - upper(from.slice(0, 10)))
}
export function fmtDate(s?: string | null): string {
  if (!s) return ''
  return s.slice(5).replace('-', '/')
}
export function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
