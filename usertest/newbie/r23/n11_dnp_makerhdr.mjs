// ラウンド23 n11: メーカー名が DNP（大日本印刷）の部品。メーカー欄の見出しの書き方いろいろ（未割当の列でも DNP と書いただけで外れないか）
import fs from 'node:fs'
import { loadParsers, T } from './parselib.mjs'
const { old, neu } = await loadParsers(process.env.OLD || '68e45f7')
const out = []
for (const h of ['メーカー', 'メーカ', 'メーカー名', 'メーカ名', '製造元', '製造メーカー', '仕入先', '購入先', '供給元', '調達先', 'Maker', 'Manufacturer', 'MFR', 'Mfr', 'Mfg', 'Vendor', 'Supplier', 'Brand', 'ブランド', '会社', '社名', '納入元', '指定メーカー', 'MAKER/VENDOR']) for (const v of ['DNP', 'dnp', 'DNP（大日本印刷）', '大日本印刷(DNP)']) {
  const t = T(`品名｜型式｜${h}｜数量\nフィルム｜FLM-1｜${v}｜2\nリレー｜MY4N-D2｜オムロン｜4`)
  const o = old.parseBomPaste(t), r = neu.parseBomPaste(t)
  out.push(`${r.rows.length === 2 ? 'OK ' : 'NG '}見出し=${h} 値=${v}: old=${o.rows.length}行 new=${r.rows.length}行 mapping=${r.mapping.join(',')}`)
}
fs.writeFileSync('results/n11_dnp_makerhdr.out', out.join('\n') + '\n')
console.log(out.filter((l) => l.startsWith('NG')).join('\n') || 'すべて OK')
