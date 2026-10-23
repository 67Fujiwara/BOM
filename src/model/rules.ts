import type { Project, Row, Rule } from './types'
import { effective } from './derive'

export interface Problem {
  rowId: string
  field: keyof Row
  ruleId: string
  severity: 'error' | 'warn'
  message: string
  /** 直し方の候補 */
  fixes: Array<{ label: string; apply: (r: Row) => Partial<Row> }>
}

const FULLWIDTH = /[Ａ-Ｚａ-ｚ０-９－．／（）]/

export function toHalfWidth(s: string): string {
  return s
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/－/g, '-')
    .replace(/．/g, '.')
    .replace(/／/g, '/')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/　/g, ' ')
}

/** 1行に対してルールを評価する。working（作業中）の値を優先 */
/** 商社マスタ（指定先が実在するかを見るため。ストアが読み込み・変更のたびに渡す） */
let supplierMaster: Array<{ id: string; name: string }> = []
export function setSupplierMaster(list: Array<{ id: string; name: string }>) {
  supplierMaster = list
}

export function checkRow(row: Row, rules: Rule[], project: Project): Problem[] {
  const out: Problem[] = []
  if (row.status === 'cancelled' || row.status === 'replaced') return out
  const e = effective(row)
  for (const rule of rules) {
    if (!rule.enabled) continue
    if (rule.scope !== 'all' && rule.scope !== project.id) continue
    if (row.ackRules.includes(rule.id) && rule.severity === 'warn') continue
    const v = (e as unknown as Record<string, unknown>)[rule.field]
    const str = v == null ? '' : String(v)
    const field = rule.field
    let severity = rule.severity
    // メーカ指定＝任意 の行はメーカ必須を警告に落とす
    if (rule.type === 'required' && field === 'maker' && e.makerLock === '任意') severity = 'warn'
    if (row.ackRules.includes(rule.id) && severity === 'warn') continue
    const push = (fixes: Problem['fixes']) => out.push({ rowId: row.id, field, ruleId: rule.id, severity, message: rule.message, fixes })
    switch (rule.type) {
      case 'designated':
        if ((e.procurement === '指定商社' || e.procurement === '客先指定品') && str.trim() === '') push([])
        // 指定商社の指定先は商社マスタから（§3.1）。誤記のまま別の商社に依頼しない
        else if (e.procurement === '指定商社' && supplierMaster.length && !supplierMaster.some((x) => x.id === str.trim() || x.name === str.trim())) {
          const near = supplierMaster.find((x) => x.name.startsWith(str.trim().slice(0, 2)))
          out.push({ rowId: row.id, field, ruleId: rule.id, severity: 'error', message: `指定先「${str}」は商社マスタにありません（${supplierMaster.map((x) => x.name).join(' / ')}）`, fixes: near ? [{ label: `「${near.name}」にする`, apply: () => ({ designated: near.id }) }] : [] })
        }
        break
      case 'required':
        if (str.trim() === '') {
          const fixes: Problem['fixes'] = []
          if (field === 'maker') {
            const same = project.rows.find((r) => r.id !== row.id && effective(r).model === e.model && effective(r).maker)
            if (same) fixes.push({ label: `同じ型式の行から「${effective(same).maker}」を入れる`, apply: () => ({ maker: effective(same).maker }) })
          }
          push(fixes)
        }
        break
      case 'positive':
        if (!(Number(v) > 0)) push([{ label: '1 にする', apply: () => ({ [field]: 1 }) as Partial<Row> }])
        break
      case 'noWhitespace':
        if (str !== str.trim() || /\s{2,}/.test(str)) push([{ label: '前後の空白を削除', apply: () => ({ [field]: str.trim().replace(/\s{2,}/g, ' ') }) as Partial<Row> }])
        break
      case 'noFullWidth':
        if (FULLWIDTH.test(str)) push([{ label: '半角に変換', apply: () => ({ [field]: toHalfWidth(str) }) as Partial<Row> }])
        break
      case 'regex':
        // 書き方の誤ったルール（正規表現として読めない）は、画面を止めずに飛ばす
        try {
          if (rule.pattern && str && (!rule.maker || rule.maker === e.maker) && (!rule.when || new RegExp(rule.when).test(str))) {
            const re = new RegExp(rule.pattern)
            if (!re.test(str)) push([])
          }
        } catch {
          /* 読めないルールは無視 */
        }
        break
      case 'duplicate':
        // 取消・置換の作業中の行と、置換の元と先（同じ部品位置を引き継ぐ）どうしは重複に数えない
        if (str && project.rows.some((r) => r.id !== row.id && r.status !== 'cancelled' && r.status !== 'replaced' && !r.removal && !r.pendingRemoval && !row.removal && !row.pendingRemoval && r.replaces !== row.id && row.replaces !== r.id && String(effective(r)[field as keyof typeof e] ?? '') === str)) push([])
        break
      case 'packMultiple':
        // 単位が「パック」なら数量はパック数。個数で数える単位で入数があるときだけ倍数を確かめる
        if (e.unit !== 'パック' && e.packQty && e.packQty > 1 && e.qtyNeeded % e.packQty !== 0) {
          const up = Math.ceil(e.qtyNeeded / e.packQty) * e.packQty
          const packs = Math.ceil(e.qtyNeeded / e.packQty)
          push([
            { label: `入数の倍数 ${up} ${e.unit}にする`, apply: () => ({ qtyNeeded: up }) },
            { label: `単位をパックにして ${packs} パックにする`, apply: () => ({ unit: 'パック', qtyNeeded: packs }) as Partial<Row> },
          ])
        }
        break
      case 'altConsistent': {
        const other = project.rows.find((r) => r.id !== row.id && effective(r).model === e.model && effective(r).altPolicy !== e.altPolicy)
        if (e.model && other) push([{ label: `${other.id} と同じ「${effective(other).altPolicy}」にする`, apply: () => ({ altPolicy: effective(other).altPolicy }) }])
        break
      }
    }
  }
  // §3.1: メーカ指定＝任意 と 代替可否＝不可 は矛盾（メーカは自由なのに代替を認めない）。ルールの登録に関係なく常に見る
  const MAKER_ALT = 'sys.makerlock.alt'
  if (e.makerLock === '任意' && e.altPolicy === '不可' && !row.ackRules.includes(MAKER_ALT))
    out.push({ rowId: row.id, field: 'altPolicy', ruleId: MAKER_ALT, severity: 'warn', message: 'メーカ指定＝任意 と 代替可否＝不可 は矛盾しています', fixes: [{ label: '代替可否を「同等品可」にする', apply: () => ({ altPolicy: '同等品可' }) }, { label: 'メーカ指定を「推奨」にする', apply: () => ({ makerLock: '推奨' }) }] })
  return out
}

export function checkProject(project: Project, rules: Rule[]): Problem[] {
  return project.rows.flatMap((r) => checkRow(r, rules, project))
}
