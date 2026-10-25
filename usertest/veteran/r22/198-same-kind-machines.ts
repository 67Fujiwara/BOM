// (A) 変えていない印（SAME）の言い方 (B) 矢印の規則 (C) 号機ごとの旧／新（一部だけ新を書く）(D) 変更区分の値 (E) 備考と変更内容の列の選び方
import fs from 'node:fs'
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { parseBomPaste } = await import(SRC + '/io/paste.ts')
const T = (rows: string[][]) => rows.map((r) => r.join('\t')).join('\n')
const out: any = {}
const log = (k: string, s: string) => console.log(`[${k}] ${s}`)
// ---- A. SAME 印
{
  const SAME = ['－', '-', 'ー', '―', '—', '–', '−', '‐', 'ｰ', '--', '---', '－－', '──', '─', '～', '〜', '…', '／', '/', '↑', '↓', '同左', '変更なし', '変更無し', '変更無', '変更ナシ', '変更なし。', '変更なし ', '（変更なし）', '【変更なし】', '[変更なし]', 'そのまま', 'そのまま使用', '不変', '据置', '据え置き', '現状維持', '現状のまま', '変更せず', '変更しない', '変更ありません', '変更はありません', '変更不要', '変えず', 'No change', 'no change', 'NO CHANGE', 'No Change', 'unchanged', 'Unchanged', 'UNCHANGED', 'same', 'Same', 'SAME', 'as is', 'AS-IS', 'asis', 'N.C.', 'NC', 'n/c', 'N/C', '同じ', '同一', '同', '同上', '〃', '"', '上に同じ', '上記同様', '旧に同じ', '旧と同じ', '従来通り', '従来どおり', '現行通り', '現行どおり', '継続', '継続使用', '流用', '流用品', '無変更', '前回同様', 'ママ', '変更点なし', '変更箇所なし', '変更なし(流用)']
  const LEGIT = ['NC', 'N.C.', 'NO', 'SAME-1', 'AS-1', '同期モータ', '同軸ケーブル', '同等品', '流用品A', '-1', 'D', 'd', 'ditto-1', 'No-Change']
  const probe = (x: string) => {
    const r = parseBomPaste(T([['部品名', '旧型式', '新型式', '数量'], ['基準A', 'MY2N', 'MY4N', '1'], ['基準B', 'XA-1', 'XA-2', '1'], ['対象', 'ZZ-100', x, '4'], ['基準D', 'Q-1', '', '5']]))
    const t = r.rows.find((q: any) => q.name === '対象')
    return !t ? 'DELETED' : t.model === 'ZZ-100' ? 'old' : t.model === x ? 'newval' : `other:${t.model}`
  }
  const res: Record<string, string[]> = {}
  for (const x of SAME) (res[probe(x)] ??= []).push(x)
  out.sameMarks = res
  log('A SAME', Object.entries(res).map(([k, v]) => `${k}(${v.length}): ${v.join(' ｜ ')}`).join('\n   '))
  const resL: Record<string, string[]> = {}
  for (const x of LEGIT) (resL[probe(x)] ??= []).push(x)
  out.sameLegit = resL
  log('A legit-as-new-model', Object.entries(resL).map(([k, v]) => `${k}(${v.length}): ${v.join(' ｜ ')}`).join('\n   '))
}
// ---- B. 矢印
{
  const CELLS = ['USB-A→USB-C', 'USB-A→USB-C 変換ケーブル', '(赤→黒)', 'M12→M8 変換', 'M12→M8', 'RS485→USB', 'D-sub9→USB', 'AC100V>DC24V', 'AC100V→DC24V', 'TYPE>=5', 'USB-A->USB-C', 'USB-A->', '->USB', '1>2', 'A>B', 'A→B', 'X=>Y', 'X⇒Y', 'MY2N→MY4N-D2', 'MY2N → MY4N-D2', 'MY2N  →  MY4N', 'MY2N→ MY4N', 'MY2N →MY4N', '10→12', '10 → 12', '10→12個', '3個→5個', '３→５', '３個→５個', 'ＭＹ２Ｎ→ＭＹ４Ｎ', 'MY2N→MY4N→MY6N', '→MY4N', 'MY4N→', 'M-1→N-2', 'φ6→φ8', '6φ→8φ', '1/2"→3/4"', 'RC0603→RC0805', 'PLC→HMI', '24V→5V', '24VDC→5VDC', '24V DC→5V DC', 'HDMI→VGA', 'CAT5e→CAT6', 'M3×8→M4×10', 'M3x8→M4x10', 'SS400→SUS304', 'AWG22→AWG20', '赤→黒', 'AB→CD', '旧→新', 'オムロン→三菱', '0.75sq→1.25sq']
  const resO: Record<string, string[]> = {}, resC: Record<string, string[]> = {}, resQ: Record<string, string[]> = {}
  for (const c of CELLS) {
    // 普通の BOM の型式
    const o = parseBomPaste(T([['部品名', '型式', '数量'], ['A', c, '1'], ['B', 'M-2', '2']])).rows[0] as any
    ;(resO[o.model === c ? 'same' : `→${o.model}`] ??= []).push(c)
    // 変更表の新型式
    const ch = parseBomPaste(T([['部品名', '旧型式', '新型式', '数量'], ['A', 'OLD-1', c, '1'], ['B', 'M-2', 'M-3', '2']])).rows[0] as any
    ;(resC[ch.model === c ? 'same' : `→${ch.model}`] ??= []).push(c)
    // 数量
    const q = parseBomPaste(T([['部品名', '型式', '数量'], ['A', 'M-1', c], ['B', 'M-2', '2']])).rows[0] as any
    ;(resQ[`${q.qtyNeeded}`] ??= []).push(c)
  }
  out.arrowOrdinaryModel = resO; out.arrowChangeNewModel = resC; out.arrowQty = resQ
  log('B 普通型式', Object.entries(resO).map(([k, v]) => `${k}(${v.length}): ${v.join(' ｜ ')}`).join('\n   '))
  log('B 変更表の新型式', Object.entries(resC).map(([k, v]) => `${k}(${v.length}): ${v.join(' ｜ ')}`).join('\n   '))
  log('B 数量', Object.entries(resQ).map(([k, v]) => `${k}(${v.length}): ${v.join(' ｜ ')}`).join('\n   '))
}
// ---- C. 号機ごと
{
  const run = (name: string, hdr: string[], rows: string[][], expect: number[]) => {
    const r = parseBomPaste(T([['部品名', '型式', ...hdr], ...rows.map((x, i) => ['P' + i, 'M-' + i, ...x])]))
    const got = r.rows.map((q: any) => q.qtyNeeded)
    const ok = JSON.stringify(got) === JSON.stringify(expect)
    log('C ' + name, `${ok ? 'ok ' : 'NG '} expect=${expect} got=${got} warn=${r.warnings.filter((w: string) => /号機|数量/.test(w)).join('／').slice(0, 160)}`)
    return { name, ok, expect, got, warnings: r.warnings }
  }
  const C: any[] = []
  C.push(run('旧1旧2新1新2: 新1のみ', ['旧1号機', '旧2号機', '新1号機', '新2号機'], [['6', '6', '7', '']], [13]))
  C.push(run('旧1新1旧2新2: 新1のみ', ['旧1号機', '新1号機', '旧2号機', '新2号機'], [['6', '7', '6', '']], [13]))
  C.push(run('新2のみ', ['旧1号機', '旧2号機', '新1号機', '新2号機'], [['6', '6', '', '9']], [15]))
  C.push(run('新が逆順(新2,新1)', ['旧1号機', '旧2号機', '新2号機', '新1号機'], [['6', '6', '9', '']], [15]))
  C.push(run('旧3台・新2台(新3なし)', ['旧1号機', '旧2号機', '旧3号機', '新1号機', '新2号機'], [['6', '6', '6', '7', '']], [19]))
  C.push(run('旧3台・新1号機のみ列あり', ['旧1号機', '旧2号機', '旧3号機', '新1号機'], [['6', '6', '6', '7']], [19]))
  C.push(run('新1に0(削除の意味)', ['旧1号機', '旧2号機', '新1号機', '新2号機'], [['6', '6', '0', '']], [6]))
  C.push(run('新が－', ['旧1号機', '旧2号機', '新1号機', '新2号機'], [['6', '6', '7', '－']], [13]))
  C.push(run('新が全部空', ['旧1号機', '旧2号機', '新1号機', '新2号機'], [['6', '6', '', '']], [12]))
  C.push(run('旧が空・新だけ(追加)', ['旧1号機', '旧2号機', '新1号機', '新2号機'], [['', '', '3', '3']], [6]))
  C.push(run('旧1のみ空・新1あり', ['旧1号機', '旧2号機', '新1号機', '新2号機'], [['', '6', '3', '']], [9]))
  C.push(run('合計列つき(旧/新合計)', ['旧1号機', '旧2号機', '新1号機', '新2号機', '合計'], [['6', '6', '7', '', '13']], [13]))
  C.push(run('予備つき', ['旧1号機', '旧2号機', '旧予備', '新1号機', '新2号機', '新予備'], [['6', '6', '2', '7', '', '']], [15]))
  C.push(run('A/B号機', ['旧A号機', '旧B号機', '新A号機', '新B号機'], [['6', '6', '7', '']], [13]))
  C.push(run('#1/#2', ['旧#1', '旧#2', '新#1', '新#2'], [['6', '6', '7', '']], [13]))
  C.push(run('Unit1/Unit2 旧新', ['旧Unit1', '旧Unit2', '新Unit1', '新Unit2'], [['6', '6', '7', '']], [13]))
  C.push(run('第1号機/第2号機', ['旧第1号機', '旧第2号機', '新第1号機', '新第2号機'], [['6', '6', '7', '']], [13]))
  C.push(run('変更前/変更後 号機', ['変更前1号機', '変更前2号機', '変更後1号機', '変更後2号機'], [['6', '6', '7', '']], [13]))
  C.push(run('1号機(旧)(新)', ['1号機(旧)', '2号機(旧)', '1号機(新)', '2号機(新)'], [['6', '6', '7', '']], [13]))
  C.push(run('3台 新1のみ', ['旧1号機', '旧2号機', '旧3号機', '新1号機', '新2号機', '新3号機'], [['6', '6', '6', '7', '', '']], [19]))
  C.push(run('3台 新2のみ', ['旧1号機', '旧2号機', '旧3号機', '新1号機', '新2号機', '新3号機'], [['6', '6', '6', '', '9', '']], [21]))
  C.push(run('新に文字(要確認)', ['旧1号機', '旧2号機', '新1号機', '新2号機'], [['6', '6', '7', '未定']], [13]))
  out.machines = C
}
// ---- D. 変更区分
{
  const DEL = ['削除', '削除済', '削除済み', '削除品', '削除する', '削除します', '削除対象', '廃止', '廃止品', '撤去', '撤去済', '撤去済み', '取消', '取り消し', '欠番', '不要', '×', '✕', 'del', 'Del', 'Del.', 'DEL', 'delete', 'Delete', 'deleted', 'remove', 'Remove', 'removed', 'D', 'd', '除却', '除外', '抹消', '削', '廃', '削除予定', '撤去予定', '廃止予定', '取外し', '取り外し', '全削除', '一式削除', '(削除)', '【削除】', '削 除', '削除　', '削除（Rev.2）', '削除→R012', 'Rev.2削除', '削除 ', 'DELETE', 'Deleted', 'X', 'x', '✗', '✘', '❌', '△削除', '▲', '▼削除', '解除', '外す', 'カット', 'なし', 'ナシ', '無']
  const KEEP = ['追加', '変更', '新規', '流用', '継続', '同上', '〃', '-', '－', '変更なし', '変更無し', 'ADD', 'Add', 'add', 'NEW', 'New', 'Chg', 'Change', 'change', 'C', 'A', 'M', 'U', 'N', '追', '変', '新', '修正', '差替', '差し替え', '交換', '置換', '移設', '型式変更', '数量変更', '変更あり', '削除なし', '削除不要', '削除しない', '削除保留', '削除せず', '追加・変更', '新規追加', '仕様変更', '数量増', '数量減', '増', '減', '保留', '確認中', '現状', '現状維持', '据置', 'Mod', 'Modify', 'Update', 'Edit', 'Keep', 'Unchanged', 'No change', '空', '(空)']
  const probe = (hdr: string, v: string, kinds: string[]) => {
    const rows = [[hdr, '部品名', '型式', '数量'], ...kinds.map((k, i) => [k, 'P' + i, 'M-' + i, '1']), [v, '対象', 'ZZ-100', '4']]
    const r = parseBomPaste(T(rows))
    return r.rows.some((q: any) => q.name === '対象') ? 'kept' : 'DELETED'
  }
  const resD: Record<string, string[]> = {}, resK: Record<string, string[]> = {}
  for (const v of DEL) (resD[probe('変更区分', v, ['追加', '変更', '追加'])] ??= []).push(v)
  for (const v of KEEP) (resK[probe('変更区分', v, ['追加', '変更', '削除'])] ??= []).push(v)
  out.kindDel = resD; out.kindKeep = resK
  log('D 変更区分 DEL', Object.entries(resD).map(([k, v]) => `${k}(${v.length}): ${v.join(' ｜ ')}`).join('\n   '))
  log('D 変更区分 KEEP', Object.entries(resK).map(([k, v]) => `${k}(${v.length}): ${v.join(' ｜ ')}`).join('\n   '))
  // 見出し違い
  const H = ['変更区分', '区分', '種別', '処置', '改訂区分', '改訂種別', 'ECN区分', 'ECN種別', '設変区分', '設変種別', '変更の種類', 'Change', 'Change Type', 'ChangeType', 'Action', 'アクション', '対応', '変更内容', '変更', '変更種別', '更新区分', '修正区分', '追加削除', '状態', 'ステータス', 'Status', '備考区分', '処置区分', '変更点', '変更有無', '採否', '要否']
  const resH: Record<string, string[]> = {}
  for (const h of H) {
    const a = probe(h, '削除', ['追加', '変更', '追加']), b = probe(h, '削除', ['追加', '変更', '修正'])
    ;(resH[`${a}/${b}`] ??= []).push(h)
  }
  out.kindHeaders = resH
  log('D 見出し (値=追加/変更/追加 | 追加/変更/修正)', Object.entries(resH).map(([k, v]) => `${k}(${v.length}): ${v.join(' ｜ ')}`).join('\n   '))
  // 「変更」だけの見出しに 要/不要
  const r1 = parseBomPaste(T([['変更', '部品名', '型式', '数量'], ['要', 'A', 'M-1', '1'], ['不要', 'B', 'M-2', '1'], ['要', 'C', 'M-3', '1']]))
  log('D 見出し「変更」に 要/不要', `rows=${r1.rows.map((q: any) => q.name).join(',')} warn=${r1.warnings.join('／').slice(0, 120)}`)
  out.henkouYoufuyou = r1.rows.map((q: any) => q.name)
}
// ---- E. 備考と変更内容
{
  const sets: Array<[string, string[], string[][]]> = [
    ['備考|変更内容 (削除は変更内容)', ['備考', '変更内容'], [['盤内', '型式変更'], ['', '削除'], ['要予備', '']]],
    ['変更内容|備考 (削除は備考)', ['変更内容', '備考'], [['型式変更', '盤内'], ['', '削除'], ['', '要予備']]],
    ['変更内容|備考 (削除は変更内容)', ['変更内容', '備考'], [['型式変更', '盤内'], ['削除', ''], ['', '要予備']]],
    ['変更理由のみ (削除)', ['変更理由'], [['型式変更'], ['削除'], ['']]],
    ['変更内容|変更理由 (削除は理由)', ['変更内容', '変更理由'], [['型式変更', 'A'], ['', '削除'], ['', '']]],
    ['備考|摘要', ['備考', '摘要'], [['盤内', 'x'], ['', '削除'], ['要予備', '']]],
    ['摘要|備考', ['摘要', '備考'], [['x', '盤内'], ['削除', ''], ['', '要予備']]],
    ['備考|Comment', ['備考', 'Comment'], [['盤内', 'x'], ['', '削除'], ['要予備', '']]],
  ]
  const res: any[] = []
  for (const [name, cols, vals] of sets) {
    const rows = [['部品名', '旧型式', '新型式', ...cols], ['A', 'M-1', 'N-1', ...vals[0]], ['B', 'M-2', '', ...vals[1]], ['C', 'M-3', '', ...vals[2]]]
    const r = parseBomPaste(T(rows))
    const rec = { name, names: r.rows.map((q: any) => q.name), notes: r.rows.map((q: any) => q.note ?? ''), warn: r.warnings.filter((w: string) => /備考|削除/.test(w)).map((w: string) => w.slice(0, 80)) }
    res.push(rec); log('E ' + name, `rows=${rec.names.join(',')} notes=${JSON.stringify(rec.notes)} warn=${rec.warn.join('／')}`)
  }
  out.noteCol = res
}
fs.writeFileSync(`/home/user/BOM/usertest/veteran/r22/198-same-kind-machines${process.env.TAG ?? ''}.json`, JSON.stringify(out, null, 1))
