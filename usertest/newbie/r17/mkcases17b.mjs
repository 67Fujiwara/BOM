// ラウンド17: 貼り付けの入力 その 2（EDA の書き出し・見出しのセル内改行・員数｜台数｜必要数・1 段の号機｜計・数量の〃・ページの表題と署名欄）→ cases/p17b.json
import fs from 'node:fs'
const T = (s) => s.trim().split('\n').map((l) => l.trim().split('｜').join('\t')).join('\n')
const cases = [
  ['K1 kicad-csv', `"Reference","Value","Footprint","Qty","DNP"\n"R1,R2","10k","Resistor_SMD:R_0603","2",""\n"C1","100n","Capacitor_SMD:C_0603","1","DNP"\n"U1","STM32F103C8T6","Package_QFP:LQFP-48","1",""`],
  ['K2 altium-tsv', T(`Comment｜Description｜Designator｜Footprint｜LibRef｜Quantity
10k｜Resistor｜R1, R2｜0603｜RES｜2
STM32F103C8T6｜MCU｜U1｜LQFP48｜MCU｜1`)],
  ['K3 header-cell-linebreak', `"部品\n名称"\t型式\t"メーカー\n名"\t"必要\n数量"\nリレー\tMY4N-D2\tオムロン\t4\nタイマ\tH3CR-A8\tオムロン\t2`],
  ['K4 insu-daisu-hitsuyou', T(`品名｜型式｜メーカー｜員数｜台数｜必要数
リレー｜MY4N-D2｜オムロン｜2｜3｜6
タイマ｜H3CR-A8｜オムロン｜1｜3｜3`)],
  ['K5 gouki-1tier-kei-noqtyword', T(`品名｜型式｜メーカー｜1号機｜2号機｜計
リレー｜MY4N-D2｜オムロン｜2｜2｜4
タイマ｜H3CR-A8｜オムロン｜1｜1｜2`)],
  ['K6 qty-ditto', T(`品名｜型式｜メーカー｜数量
リレー｜MY4N-D2｜オムロン｜4
リレー｜MY2N｜オムロン｜〃
タイマ｜H3CR-A8｜オムロン｜同上`)],
  ['K7 title-and-signature', T(`部品表（1/2）｜｜｜
品名｜型式｜メーカー｜数量
リレー｜MY4N-D2｜オムロン｜4
タイマ｜H3CR-A8｜オムロン｜2
以下余白｜｜｜
作成｜山田｜承認｜鈴木`)],
  ['K8 total-variants', T(`品名｜型式｜メーカー｜数量
リレー｜MY4N-D2｜オムロン｜4
タイマ｜H3CR-A8｜オムロン｜2
合計 2品目 6点｜｜｜
総合計｜｜｜6`)],
  ['K9 machine-and-unit-qty', T(`品名｜型式｜メーカー｜数量/台｜製作台数｜手配数
リレー｜MY4N-D2｜オムロン｜2｜3｜6
タイマ｜H3CR-A8｜オムロン｜1｜3｜3`)],
  ['K10 yobi-1tier', T(`品名｜型式｜メーカー｜数量｜予備｜手配数
リレー｜MY4N-D2｜オムロン｜4｜1｜5
タイマ｜H3CR-A8｜オムロン｜2｜0｜2`)],
  ['K11 eda-mpn-dnp', T(`Designator｜Comment｜Manufacturer｜Manufacturer Part Number｜Quantity｜DNP
R1, R2｜10k｜KOA｜RK73H1JTTD1002F｜2｜
C1｜100n｜Murata｜GRM188R71H104KA93D｜1｜DNP
U1｜MCU｜ST｜STM32F103C8T6｜1｜`)],
  ['K12 eda-fitted-col', T(`Designator｜Description｜Manufacturer｜MPN｜Qty｜Fitted
R1, R2｜Resistor｜KOA｜RK73H1JTTD1002F｜2｜Fitted
C1｜Capacitor｜Murata｜GRM188R71H104KA93D｜1｜Not Fitted`)],
]
fs.writeFileSync(new URL('./cases/p17b.json', import.meta.url), JSON.stringify(cases, null, 1))
console.log(cases.length)
