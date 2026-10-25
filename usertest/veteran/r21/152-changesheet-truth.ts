// ラウンド20: 変更表を「正解つき」で乱数に作り、取り込みの判定（削除・変えていない・変更・追加）の正答率を、現行と r19 ビルドで比べる。
// 型: sparse-empty（変えた行だけ。変えていない行は変更後が空）／sparse-dash（変えていない行は「－」）／copy（全部の行に書き写し。削除は変更後が空）／copy-dash（削除は「－」）
// 誤り: wrong-del = 変えていない・変更の行が消えた、wrong-keep = 削除の行が残った（【削除？】の印が付けば「知らせた」で誤りに数えない）
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { parseBomPaste } = await import(SRC + '/io/paste.ts')
import fs from 'node:fs'
let s = Number(process.env.SEED ?? 7) >>> 0
const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0), s / 4294967296)
const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)]
const ri = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1))
const N = Number(process.env.N ?? 3000)
const STY = ['sparse-empty', 'sparse-dash', 'copy', 'copy-dash'] as const
type K = 'same' | 'chg' | 'del' | 'chgq'
const REASON_CHG = ['型式変更', '変更', 'R12→R13', '位置変更', '銘板変更', '', '']
const REASON_SAME = process.env.NOCHG ? ['', '', '', '', '盤内', ''] : ['', '', '', '', '変更なし', '盤内']
const REASON_DEL = ['', '', '削除', '不要のため削除', '削除済', '廃止', '']
const tally: Record<string, any> = {}
const cases: any[] = []
for (let i = 0; i < N; i++) {
  const sty = pick([...STY])
  const twoField = rnd() < 0.4
  const withNote = sty.startsWith('sparse') ? true : rnd() < 0.6
  const n = ri(4, rnd() < 0.15 ? 150 : 14)
  // 種類の割合
  const pDel = pick([0.1, 0.25, 0.5]), pChg = pick([0.1, 0.3])
  const rows: string[][] = []
  const truth: Array<{ k: K; name: string }> = []
  const hdr = ['部品名', '型式', '変更後型式', '数量', ...(twoField ? ['変更後数量'] : []), ...(withNote ? ['備考'] : [])]
  for (let k = 1; k <= n; k++) {
    const r = rnd()
    const kind: K = r < pDel ? 'del' : r < pDel + pChg ? 'chg' : rnd() < 0.15 && sty.startsWith('sparse') ? 'chgq' : 'same'
    const q = ri(1, 6)
    let newM = '', newQ = '', note = ''
    if (kind === 'chg') { newM = `NEW-${k}`; newQ = twoField ? String(q + 1) : ''; note = pick(REASON_CHG) }
    else if (kind === 'chgq') { // 数量だけ変えた（型式は同じに書く／空）
      newM = rnd() < 0.5 ? `OLD-${k}` : ''; newQ = twoField ? String(q + 2) : ''; note = twoField ? '数量変更' : pick(REASON_SAME)
      if (!twoField) { newM = `OLD-${k}` }
    } else if (kind === 'same') {
      if (sty === 'sparse-empty') { newM = ''; newQ = ''; note = pick(REASON_SAME) }
      else if (sty === 'sparse-dash') { newM = '－'; newQ = twoField ? '－' : ''; note = pick(REASON_SAME) }
      else { newM = `OLD-${k}`; newQ = twoField ? String(q) : ''; note = pick(REASON_SAME) }
    } else { // del
      if (sty === 'copy-dash') { newM = '－'; newQ = twoField ? '－' : '' }
      else { newM = ''; newQ = '' }
      note = pick(REASON_DEL)
      if (sty.startsWith('sparse') && !/削除|廃止/.test(note)) note = pick(['削除', '不要のため削除', '削除済', '廃止'])
    }
    rows.push([`部品${k}`, `OLD-${k}`, newM, String(q), ...(twoField ? [newQ] : []), ...(withNote ? [note] : [])])
    truth.push({ k: kind, name: `部品${k}` })
  }
  const text = [hdr, ...rows].map((r) => r.join('\t')).join('\n') + '\n'
  let res: any
  try { res = parseBomPaste(text) } catch (e: any) { res = { rows: [], warnings: [String(e)] } }
  const byName = new Map<string, any>((res.rows as any[]).map((r) => [r.name, r]))
  let wrongDel = 0, wrongKeep = 0, flagged = 0
  truth.forEach((t) => {
    const r = byName.get(t.name)
    const isFlag = !!r && String(r.note ?? '').startsWith('【削除？】')
    if (t.k === 'del') { if (r && !isFlag) wrongKeep++; else if (r && isFlag) flagged++ }
    else { if (!r) wrongDel++; else if (isFlag) flagged++ }
  })
  const key = `${sty}${twoField ? '/2f' : '/1f'}`
  const t = (tally[key] ??= { cases: 0, casesWrong: 0, wrongDel: 0, wrongKeep: 0, flaggedCases: 0, rows: 0 })
  t.cases++; t.rows += n; t.wrongDel += wrongDel; t.wrongKeep += wrongKeep
  if (wrongDel || wrongKeep) { t.casesWrong++; if (cases.length < 400) cases.push({ i, key, n, wrongDel, wrongKeep, counts: { del: truth.filter((x) => x.k === 'del').length, same: truth.filter((x) => x.k === 'same').length, chg: truth.filter((x) => x.k === 'chg').length, chgq: truth.filter((x) => x.k === 'chgq').length }, text: n <= 14 ? text : undefined }) }
  if (flagged) t.flaggedCases++
}
console.log(JSON.stringify(tally, null, 1))
fs.writeFileSync('/home/user/BOM/usertest/veteran/r21/152-changesheet-truth' + (process.env.TAG ?? '') + '.json', JSON.stringify({ tally, cases: cases.slice(0, 60) }, null, 1))
