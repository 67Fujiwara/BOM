# ラウンド22: 文字コード × 区切りの決め方。dl/ に書く。Excel の「Unicode テキスト」= UTF-16LE + BOM + タブ区切り
import os
DL = '/home/user/BOM/usertest/veteran/r23/dl/'
def refs(i, k): return ', '.join(f'R{i*10+j}' for j in range(k))
def tsv(rows): return '\r\n'.join('\t'.join(r) for r in rows) + '\r\n'
def csv(rows):
    def q(c): return '"' + c.replace('"', '""') + '"' if (',' in c or '"' in c or '\n' in c) else c
    return '\r\n'.join(','.join(q(c) for c in r) for r in rows) + '\r\n'
hdr = ['部品名', '型式', '員数', '回路記号']
rows = [[f'部品{i}', f'M-{i}', '1', refs(i, 5)] for i in range(1, 11)]
simple = [['部品名', '型式', 'メーカ', '数量']] + [[f'部品{i}', f'M-{i}', 'オムロン', str(i)] for i in range(1, 11)]
simple_c = [['部品名', '型式', 'メーカ', '数量']] + [[f'部品{i}', f'M-{i}', 'Omron, Inc.' if i % 2 else 'オムロン', str(i)] for i in range(1, 11)]
ml = [['部品名', '型式', 'メーカ', '数量', '備考']] + [[f'部品{i}', f'M-{i}', 'Omron, Inc.', str(i), '"1行目\n2行目\n3行目"'] for i in range(1, 9)]
def w(name, text, enc):
    with open(DL + name, 'wb') as f:
        data = text.encode(enc)
        if enc == 'utf-16-le': data = b'\xff\xfe' + data
        if enc == 'utf-8-sig': pass
        f.write(data)
w('f1-utf16le-refs.txt', tsv([hdr] + rows), 'utf-16-le')
w('f2-utf16le-simple.txt', tsv(simple), 'utf-16-le')
w('f3-utf16le-comma-maker.txt', tsv(simple_c), 'utf-16-le')
w('f4-sjis-tsv-refs.tsv', tsv([hdr] + rows), 'cp932')
w('f5-sjis-csv-refs.csv', csv([hdr] + rows), 'cp932')
w('f6-utf8bom-tsv-refs.tsv', tsv([hdr] + rows), 'utf-8-sig')
w('f7-utf16le-ml.txt', '\r\n'.join('\t'.join(r) for r in ml) + '\r\n', 'utf-16-le')
w('f8-sjis-tsv-comma-maker.tsv', tsv(simple_c), 'cp932')
w('f9-utf16le-single-col.txt', '\r\n'.join(['部品名'] + [f'ターミナル, {i}極' for i in range(1, 6)]) + '\r\n', 'utf-16-le')
w('f10-utf16le-title.txt', '\r\n'.join(['部品表, 制御盤A', '作成, 山田', '承認, 鈴木', 'Rev.2, 客先X', '納期, 12月', '', '\t'.join(['部品名', '型式', 'メーカ', '数量'])] + ['\t'.join(r) for r in simple_c[1:]]) + '\r\n', 'utf-16-le')
print('ok')
