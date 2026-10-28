import { normalize } from './lifecycle'
import type { DesignFields, Project, Quote, Row, Rule, Supplier, Unit, User, Workspace } from './types'
import { DEFAULT_WEIGHTS } from './score'
import { addDays, todayStr } from './dates'

const parts: Array<[string, string, string, string, number, Unit]> = [
  ['制御', 'PLC CPUユニット', 'FX5U-32MR/ES', '三菱電機', 1, '個'],
  ['制御', '入力拡張ユニット', 'FX5-16EX/ES', '三菱電機', 2, '個'],
  ['制御', '出力拡張ユニット', 'FX5-16EYR/ES', '三菱電機', 2, '個'],
  ['制御', 'アナログ入力', 'FX5-4AD', '三菱電機', 1, '個'],
  ['制御', 'リレー', 'MY4N-D2 DC24', 'オムロン', 12, '個'],
  ['制御', 'リレーソケット', 'PYF14A-E', 'オムロン', 12, '個'],
  ['制御', 'タイマ', 'H3CR-A8 AC100-240', 'オムロン', 2, '個'],
  ['制御', 'ソリッドステートリレー', 'G3NA-210B DC5-24', 'オムロン', 4, '個'],
  ['制御', '端子台', 'PT 2,5', 'フエニックス', 60, '個'],
  ['制御', '端子台エンドカバー', 'D-PT 2,5', 'フエニックス', 12, '個'],
  ['制御', 'エンドクランプ', 'CLIPFIX 35', 'フエニックス', 24, '個'],
  ['制御', 'DINレール', 'NS 35/7,5 PERF 2000MM', 'フエニックス', 3, '本'],
  ['電源', 'スイッチング電源 24V 5A', 'S8VK-G12024', 'オムロン', 1, '個'],
  ['電源', 'スイッチング電源 24V 10A', 'S8VK-G24024', 'オムロン', 1, '個'],
  ['電源', 'ノイズフィルタ', 'RSEL-2006W', 'TDKラムダ', 1, '個'],
  ['電源', 'サーキットプロテクタ 2P 10A', 'CP30-BA 2P 1-M 10A', '三菱電機', 2, '個'],
  ['電源', 'サーキットプロテクタ 2P 5A', 'CP30-BA 2P 1-M 5A', '三菱電機', 3, '個'],
  ['電源', 'ブレーカ 3P 30A', 'NF32-SV 3P 30A', '三菱電機', 1, '個'],
  ['電源', '漏電ブレーカ 3P 30A', 'NV32-SV 3P 30A 30mA', '三菱電機', 1, '個'],
  ['電源', '電磁接触器', 'S-T21 AC200V', '三菱電機', 2, '個'],
  ['電源', 'サーマルリレー', 'TH-T18 5A', '三菱電機', 2, '個'],
  ['電源', 'サージ保護器', 'LT-C32AC385', '音羽電機', 1, '個'],
  ['電源', 'インバータ 0.75kW', 'FR-E820-0.75K-1', '三菱電機', 1, '個'],
  ['電源', 'DCDCコンバータ 24→5V', 'CC10-2405SF-E', 'TDKラムダ', 1, '個'],
  ['操作', '押しボタン 緑', 'A22NN-BPM-NGA-G100-NN', 'オムロン', 3, '個'],
  ['操作', '押しボタン 赤', 'A22NN-BPM-NRA-G100-NN', 'オムロン', 3, '個'],
  ['操作', '非常停止ボタン', 'A22NE-M-P202-N', 'オムロン', 1, '個'],
  ['操作', 'セレクタスイッチ 2ノッチ', 'A22NS-2BL-NBA-G110-NN', 'オムロン', 2, '個'],
  ['操作', 'キースイッチ', 'A22NK-2BL-01BA-G110', 'オムロン', 1, '個'],
  ['操作', '表示灯 白', 'M22N-BC-TWA-WC', 'オムロン', 2, '個'],
  ['操作', '表示灯 赤', 'M22N-BC-TRA-RC', 'オムロン', 2, '個'],
  ['操作', 'ブザー', 'M2BJ-B24D', 'オムロン', 1, '個'],
  ['操作', 'タッチパネル 7インチ', 'GS2107-WTBD', '三菱電機', 1, '個'],
  ['操作', '安全リレーユニット', 'G9SE-201', 'オムロン', 1, '個'],
  ['センサ', '光電センサ 反射', 'E3Z-D62 2M', 'オムロン', 6, '個'],
  ['センサ', '光電センサ 透過', 'E3Z-T61 2M', 'オムロン', 2, '個'],
  ['センサ', '近接センサ M12', 'E2E-X4MD1-M1', 'オムロン', 8, '個'],
  ['センサ', '近接センサ M8', 'E2E-X2D1-M1', 'オムロン', 4, '個'],
  ['センサ', 'ファイバセンサアンプ', 'E3X-HD11 2M', 'オムロン', 2, '個'],
  ['センサ', 'ファイバユニット', 'E32-D11 2M', 'オムロン', 2, '個'],
  ['センサ', '圧力センサ', 'E8PC-100', 'オムロン', 1, '個'],
  ['センサ', '温度センサ K熱電対', 'E52-CA1D M6 2M', 'オムロン', 2, '個'],
  ['センサ', 'リミットスイッチ', 'D4N-1120', 'オムロン', 4, '個'],
  ['センサ', 'セーフティドアスイッチ', 'D4NS-1AF', 'オムロン', 2, '個'],
  ['センサ', 'エンコーダ', 'E6B2-CWZ6C 1000P/R 2M', 'オムロン', 1, '個'],
  ['センサ', 'センサコネクタケーブル M12', 'XS5W-D421-D81-F', 'オムロン', 10, '本'],
  ['配線', 'KIV 1.25sq 黒', 'KIV 1.25 黒', '住友電装', 200, 'm'],
  ['配線', 'KIV 1.25sq 赤', 'KIV 1.25 赤', '住友電装', 100, 'm'],
  ['配線', 'KIV 1.25sq 青', 'KIV 1.25 青', '住友電装', 100, 'm'],
  ['配線', 'KIV 2sq 黒', 'KIV 2 黒', '住友電装', 100, 'm'],
  ['配線', 'KIV 5.5sq 黒', 'KIV 5.5 黒', '住友電装', 30, 'm'],
  ['配線', 'IV 5.5sq 緑/黄', 'IV 5.5 緑黄', '住友電装', 20, 'm'],
  ['配線', 'CVV 1.25sq 6C', 'CVV 1.25x6C', '住友電装', 50, 'm'],
  ['配線', '圧着端子 Y形 1.25-3', '1.25Y-3', 'ニチフ', 10, 'パック'],
  ['配線', '圧着端子 丸 2-4', 'R2-4', 'ニチフ', 5, 'パック'],
  ['配線', '棒端子 1.25', 'TC-1.25-11T', 'ニチフ', 5, 'パック'],
  ['配線', 'フェルール 1.5', 'AI 1,5-8 BK', 'フエニックス', 10, 'パック'],
  ['配線', 'ワイヤダクト 40x60', 'VD-4060', '興和化成', 6, '本'],
  ['配線', 'ワイヤダクト 60x80', 'VD-6080', '興和化成', 4, '本'],
  ['配線', '結束バンド 150', 'AB150', 'ヘラマンタイトン', 3, 'パック'],
  ['配線', 'マークチューブ', 'MT-2.5 白', 'レイマック', 2, '本'],
  ['配線', 'ケーブルグランド M20', 'RCG-M20', 'ラピッド', 12, '個'],
  ['配線', 'ケーブルグランド M25', 'RCG-M25', 'ラピッド', 6, '個'],
  ['配線', 'アース端子台', 'UT 6-PE', 'フエニックス', 6, '個'],
  ['表示', 'デジタルパネルメータ', 'K3HB-XVD AC100-240', 'オムロン', 1, '個'],
  ['表示', '積層信号灯', 'LR6-302WJNW-RYG', 'パトライト', 1, '個'],
  ['表示', '信号灯ポール', 'POLE-M20-6', 'パトライト', 1, '個'],
  ['表示', '盤用LED照明', 'LED-SL-12', '遠藤照明', 1, '個'],
  ['表示', '盤用ファン', 'IP55-120', 'オリエンタルモーター', 2, '個'],
  ['表示', 'ファンフィルタ', 'FF-120', 'オリエンタルモーター', 2, '個'],
  ['表示', 'サーモスタット', 'KTO 011', 'STEGO', 1, '個'],
  ['表示', 'ドアスイッチ', 'D4SL-N2AFA-D', 'オムロン', 1, '個'],
  ['表示', 'コンセント AC100', 'NR3210', 'パナソニック', 2, '個'],
  ['表示', 'LANケーブル 3m', 'XS6W-6LSZH8SS300CM-Y', 'オムロン', 2, '本'],
  ['表示', 'スイッチングハブ', 'W4S1-05B', 'オムロン', 1, '個'],
  ['表示', 'USBアイソレータ', 'USB-ISO', 'ラトック', 1, '個'],
  ['表示', 'シリアルケーブル', 'GT09-C30R2-6P', '三菱電機', 1, '本'],
  ['表示', '盤用時計', 'TK-100', 'セイコー', 1, '個'],
  ['表示', '盤内温度計', 'TM-50', '佐藤計量器', 1, '個'],
  ['表示', 'ラベルプリンタテープ', 'TZe-231', 'ブラザー', 3, '個'],
]

export const SUPPLIER_COLORS = ['#2a5bd7', '#14804f', '#e39a00', '#8a3ffc', '#d02a3c', '#0f7b8a', '#b5651d', '#5b6168', '#c71585']

export function supplierColor(i: number): string {
  if (i < SUPPLIER_COLORS.length) return SUPPLIER_COLORS[i]
  return `hsl(${Math.round((i * 137.5) % 360)} 60% 45%)`
}

export function makeSupplier(id: string, name: string, i: number, partial: Partial<Supplier> = {}): Supplier {
  return { id, name, color: supplierColor(i), order: i, kind: '商社', tradable: true, avl: true, handledMakers: [], onTimeRate: null, defectRate: null, ...partial }
}

export const SAMPLE_SUPPLIERS: Supplier[] = [
  makeSupplier('S1', '因幡電機', 0, { onTimeRate: 0.97, defectRate: 0.005, handledMakers: ['三菱電機', 'オムロン', 'フエニックス', 'TDKラムダ', '住友電装', 'ニチフ', 'パトライト', '興和化成'] }),
  makeSupplier('S2', '立花エレテック', 1, { onTimeRate: 0.92, defectRate: 0.01, handledMakers: ['三菱電機', 'オムロン', 'フエニックス', 'TDKラムダ', '音羽電機', 'パナソニック', 'オリエンタルモーター'] }),
  makeSupplier('S3', 'ミスミ', 2, { onTimeRate: null, defectRate: null, handledMakers: [] }),
  makeSupplier('S4', 'RSコンポーネンツ', 3, { onTimeRate: 0.95, defectRate: 0.008, handledMakers: [] }),
  makeSupplier('S5', 'オムロン直販', 4, { kind: '直販', onTimeRate: 0.99, defectRate: 0.002, handledMakers: ['オムロン'] }),
]

export const DESIGN_DEFAULTS: DesignFields = { ref: '', drawing: '', category: '', name: '', model: '', maker: '', qtyNeeded: 1, unit: '個', packQty: null, procurement: '相見積', makerLock: '推奨', altPolicy: '同等品可', designated: '', needOffset: null, needDateFixed: null, tags: '', note: '' }

export function newRow(id: string, partial: Partial<Row> = {}, at = new Date().toISOString()): Row {
  return { ...DESIGN_DEFAULTS, id, hidden: false, status: 'draft', flags: {}, orderQty: null, extraCost: null, extraCostKind: '', ordered: false, received: false, ackRules: [], deferredRules: [], statusChangedAt: at, ...partial }
}

export function rowId(n: number): string {
  return 'R' + String(n).padStart(3, '0')
}

export function emptyQuote(rowId: string, supplierId: string): Quote {
  return { rowId, supplierId, unitPrice: null, leadDays: null, moq: null, stock: null, quoteQty: null, validUntil: null, note: '', formalPrice: null, formalLeadDays: null, formalValidUntil: null, formalDiffReason: '' }
}

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

export const DEFAULT_SETTINGS: Project['settings'] = {
  currency: '¥',
  budget: null,
  processDays: 10,
  tieThreshold: 5,
  exceptionAmount: 10000,
  exceptionPct: 0.03,
  formalDiffPct: 0.1,
  formalDiffAmount: 10000,
  qtyTolerancePct: 0.2,
  surplusAmount: 20000,
  quoteCompleteRule: 'deadline',
  quoteDeadline: null,
  changeNeedsPmApproval: false,
  selector: 'design',
  pmConfirmed: false,
  externalApprovalAmount: 300000,
  externalApprovalBudgetPct: 0.05,
  quoteDays: 5,
  formalDays: 7,
  leadMarginDays: 5,
  digestMail: true,
  holidays: [],
}

export function newProject(id: string, name: string, partial: Partial<Project> = {}): Project {
  const now = new Date().toISOString()
  return {
    id,
    name,
    customer: '',
    completed: false,
    dueDate: null,
    members: { design: '', purchasing: '', pm: '' },
    preferredSupplierIds: [],
    supplierIds: [],
    rows: [],
    quotes: [],
    issues: [],
    submissions: [],
    decisions: [],
    weights: { ...DEFAULT_WEIGHTS },
    rowWeights: {},
    settings: { ...DEFAULT_SETTINGS },
    events: [{ id: 1, at: now, by: { name: '', role: 'design' }, text: '案件を作成' }],
    createdAt: now,
    updatedAt: now,
    version: 1,
    requestRevs: {},
    nextIssueNo: 1,
    nextDecisionNo: 1,
    caseDecisions: [],
    ...partial,
  }
}

const DESIGNER: User = { name: '山田', role: 'design' }
const BUYER: User = { name: '佐藤', role: 'purchasing' }

export function makeSampleProject(): Project {
  const rnd = seeded(7)
  const today = todayStr()
  const ago = (d: number, h = 0) => new Date(Date.now() - d * 86400000 - h * 3600000).toISOString()
  const supplierIds = ['S1', 'S2', 'S3']
  const rows: Row[] = parts.map(([category, name, model, maker, qty, unit], i) =>
    newRow(rowId(i + 1), { category, name, model, maker, qtyNeeded: qty, unit, ref: `${category.slice(0, 1)}${i + 1}`, drawing: 'E-2026-041-' + String(Math.floor(i / 20) + 1).padStart(2, '0'), status: 'quoted', publishedRev: 1, packQty: unit === 'パック' ? 100 : null, makerLock: i % 7 === 0 ? '指定' : '推奨', altPolicy: i % 7 === 0 ? '不可' : '同等品可' }, ago(2)),
  )
  // わざと問題を入れる（指摘・チェックのデモ）
  rows[4].model = 'MY4N-D2 DC24 '
  rows[8].maker = ''
  rows[15].model = 'CP30-BA 2P'
  rows[21].note = '2026/9 生産終了'
  rows[40].maker = ''
  rows[53].qtyNeeded = 0
  rows[60].model = 'ＭＴ－２．５ 白'
  rows[33].procurement = '客先指定品'
  rows[33].makerLock = '指定'
  rows[33].altPolicy = '不可'
  rows[33].designated = 'オムロン / 客先承認 KS-2026-118'
  rows[44].procurement = '指定商社'
  rows[44].designated = 'S2'
  rows[22].needOffset = -7 // 先行手配品（案件必要日の7日前）
  const quotes: Quote[] = []
  const base = [120, 450, 980, 2400, 8040, 15800, 36000, 62000]
  rows.forEach((r, i) => {
    const b = base[i % base.length] * (0.7 + rnd() * 0.6)
    supplierIds.forEach((sid, j) => {
      const q = emptyQuote(r.id, sid)
      quotes.push(q)
      if (rnd() < 0.06) return // 未回答
      if (rnd() < 0.03) {
        q.leadDays = -1 // 辞退
        return
      }
      q.unitPrice = Math.round(b * (0.9 + rnd() * 0.25 + j * 0.02))
      q.leadDays = Math.round(2 + rnd() * 26)
      q.stock = rnd() < 0.2 ? '在庫' : rnd() < 0.5 ? '取寄' : '受注生産'
      if (q.stock === '在庫') q.leadDays = 0
      q.quoteQty = r.qtyNeeded
      q.validUntil = addDays(today, 30 + Math.round(rnd() * 30))
      if (r.unit === 'm') q.moq = 100
      if (rnd() < 0.06) q.moq = r.qtyNeeded * 2
    })
  })
  // 一部は未見積（下書き）
  for (const i of [75, 76, 77, 78, 79]) {
    rows[i].status = 'draft'
    rows[i].publishedRev = undefined
    for (let k = quotes.length - 1; k >= 0; k--) if (quotes[k].rowId === rows[i].id) quotes.splice(k, 1)
  }
  for (const r of rows) if (r.status === 'quoted') r.quotedAt = addDays(today, -1)
  // 選定済・正式見積の行
  for (const i of [0, 1, 2, 12]) {
    rows[i].status = 'selected'
    rows[i].adoptedSupplierId = 'S1'
    rows[i].scoreSnapshot = 88
  }
  rows[12].status = 'formalQuoted'
  const fq = quotes.find((q) => q.rowId === rows[12].id && q.supplierId === 'S1')!
  fq.formalPrice = Math.round((fq.unitPrice ?? 10000) * 1.15)
  fq.formalLeadDays = fq.leadDays
  fq.formalValidUntil = addDays(today, 45)
  fq.formalDiffReason = '為替'
  fq.formalRequestNo = 'P-2026-041-S1-1'
  rows[12].flags.formalDiff = true
  const due = addDays(today, 29)
  const snapshot: Project['submissions'][number]['snapshot'] = {}
  for (const r of rows) if (r.status !== 'draft') snapshot[r.id] = { ref: r.ref, drawing: r.drawing, category: r.category, name: r.name, model: r.model, maker: r.maker, qtyNeeded: r.qtyNeeded, unit: r.unit, packQty: r.packQty, procurement: r.procurement, makerLock: r.makerLock, altPolicy: r.altPolicy, designated: r.designated, needOffset: r.needOffset, needDateFixed: r.needDateFixed, tags: r.tags, note: r.note, status: r.status }
  return newProject('P-2026-041', '第3ライン 搬送制御盤', {
    dueDate: due,
    members: { design: '山田', purchasing: '佐藤', pm: '鈴木' },
    preferredSupplierIds: ['S1', 'S2'],
    supplierIds,
    rows,
    quotes,
    issues: [
      { id: 'I-001', rowId: 'R016', field: 'model', kind: '型式あいまい', text: '定格電流の表記が無い。5A/10Aどちらか。', by: BUYER, at: ago(1), rev: 1, status: 'open', replies: [], bounceCount: 0, dueAt: addDays(today, 1) },
      { id: 'I-002', rowId: 'R022', field: 'model', kind: '廃番', text: '2026/9で生産終了。後継 LT-C32AC385A を提案。', proposal: { model: 'LT-C32AC385A', maker: '音羽電機', supplierId: 'S2', unitPrice: 9800, leadDays: 7, moq: 1 }, by: BUYER, at: ago(1), rev: 1, status: 'open', replies: [], bounceCount: 0, dueAt: addDays(today, 3) },
      { id: 'I-003', rowId: 'R009', field: 'maker', kind: 'メーカ未記入', text: 'メーカが空欄。', by: BUYER, at: ago(0, 5), rev: 1, status: 'open', replies: [], bounceCount: 0, dueAt: addDays(today, 1) },
      { id: 'I-004', rowId: 'R054', field: 'qtyNeeded', kind: '最小ロット', text: '数量0。パック単位の入数を確認。', by: BUYER, at: ago(0, 4), rev: 1, status: 'open', replies: [], bounceCount: 0, dueAt: addDays(today, 2) },
      { id: 'I-005', rowId: 'R041', field: 'maker', kind: 'メーカ未記入', text: 'メーカが空欄。', by: BUYER, at: ago(0, 4), rev: 1, status: 'open', replies: [], bounceCount: 0, dueAt: addDays(today, 1) },
    ],
    submissions: [{ rev: 1, at: ago(2), by: DESIGNER, rowIds: rows.filter((r) => r.status !== 'draft').map((r) => r.id), summary: { added: 75, modelChanged: 0, qtyChanged: 0, other: 0, cancelled: 0 }, snapshot, causes: {}, acked: [] }],
    settings: { ...DEFAULT_SETTINGS, budget: 2800000, quoteDeadline: addDays(today, 3), pmConfirmed: true },
    events: [
      { id: 1, at: ago(3), by: DESIGNER, text: '案件を作成' },
      { id: 2, at: ago(2), by: DESIGNER, text: '提出 Rev.1（75行）' },
      { id: 3, at: ago(1), by: BUYER, text: '概算見積を依頼（因幡電機・立花エレテック・ミスミ）' },
    ],
    createdAt: ago(3),
    nextIssueNo: 6,
  })
}

export const DEFAULT_RULES: Rule[] = [
  { id: 'rule.name.required', name: '部品名は必須', field: 'name', type: 'required', severity: 'error', message: '部品名が空です', owner: 'system', scope: 'all', enabled: true },
  { id: 'rule.model.required', name: '型式は必須', field: 'model', type: 'required', severity: 'error', message: '型式が空です', owner: 'system', scope: 'all', enabled: true },
  { id: 'rule.maker.required', name: 'メーカは必須', field: 'maker', type: 'required', severity: 'error', message: 'メーカが空です', fromIssueKind: 'メーカ未記入', owner: 'system', scope: 'all', enabled: true },
  { id: 'rule.qty.positive', name: '必要数は1以上', field: 'qtyNeeded', type: 'positive', severity: 'error', message: '必要数が0以下です', owner: 'system', scope: 'all', enabled: true },
  { id: 'rule.alt.required', name: '代替可否は必須', field: 'altPolicy', type: 'required', severity: 'error', message: '代替可否が未記入です', owner: 'system', scope: 'all', enabled: true },
  { id: 'rule.designated.required', name: '指定先は必須（指定商社・客先指定品）', field: 'designated', type: 'designated', severity: 'error', message: '指定先が未記入です（指定商社 / 客先指定品）', owner: 'system', scope: 'all', enabled: true },
  { id: 'rule.model.ws', name: '型式の前後に空白なし', field: 'model', type: 'noWhitespace', severity: 'warn', message: '型式の前後に空白があります', owner: 'system', scope: 'all', enabled: true },
  { id: 'rule.model.fw', name: '型式に全角文字なし', field: 'model', type: 'noFullWidth', severity: 'warn', message: '型式に全角文字が含まれています', owner: 'system', scope: 'all', enabled: true },
  { id: 'rule.ref.dup', name: '回路記号の重複なし', field: 'ref', type: 'duplicate', severity: 'warn', message: '回路記号が他の行と重複しています', owner: 'system', scope: 'all', enabled: true },
  { id: 'rule.pack.multiple', name: '数量は入数の倍数', field: 'qtyNeeded', type: 'packMultiple', severity: 'warn', message: '数量が入数の倍数ではありません（パック売りなら単位をパックに）', fromIssueKind: '最小ロット', owner: 'system', scope: 'all', enabled: true },
  { id: 'rule.alt.consistent', name: '同一型式で代替可否が一致', field: 'altPolicy', type: 'altConsistent', severity: 'warn', message: '同じ型式の行と代替可否が違います', owner: 'system', scope: 'all', enabled: true },
  { id: 'rule.model.cp30', name: 'CP30は定格電流まで書く', field: 'model', type: 'regex', pattern: '^CP30-.*\\d+A$', when: '^CP30', maker: '三菱電機', severity: 'warn', message: 'CP30 は定格電流（例: 10A）まで書いてください', fromIssueKind: '型式あいまい', owner: '佐藤', scope: 'all', enabled: true },
]

/** 最初は空（案件・在庫・購入歴なし）。サンプルは「サンプルを入れる」で足す */
export function makeWorkspace(): Workspace {
  return { user: { name: '山田', role: 'design' }, projects: [], stock: [], purchases: [], suppliers: SAMPLE_SUPPLIERS, rules: DEFAULT_RULES, currentProjectId: '' }
}

/** サンプル（案件 1 件・在庫・購入歴）を足す。呼び出し側が ws に反映する */
export function addSampleTo(ws: Workspace): string {
  const p = makeSampleProject()
  p.customer = 'サンプル客先'
  // 案件番号の例（重ならない番号にする）
  let n = 100001
  while (ws.projects.some((x) => x.id === `S${n}`)) n++
  p.id = `S${n}`
  p.name = 'サンプル装置'
  ws.projects.push(p)
  ws.currentProjectId = p.id
  normalize(p, ws)
  const k = ws.stock.length
  const items: Array<[string, string, string, number, Unit, string]> = [
    ['リレー', 'MY4N-D2 DC24V', 'オムロン', 20, '個', '棚A-1'],
    ['タイマ', 'H3CR-A8', 'オムロン', 5, '個', '棚A-2'],
    ['端子台', 'XW2B-20G4', 'オムロン', 12, '個', '棚B-1'],
    ['ヒューズ', 'F-5A', 'ミスミ', 100, '個', '棚C-3'],
    ['電線', 'VCTF 2sq', '住電', 50, 'm', 'ドラム置場'],
  ]
  items.forEach(([name, model, maker, qty, unit, location], i) => ws.stock.push({ id: `ST${String(k + i + 1).padStart(4, '0')}`, name, model, maker, qty, unit, location, note: '' }))
  const k2 = ws.purchases.length
  const hist: Array<[string, string, string, number, string, string]> = [
    ['コンタクタ', 'SC-N2 DC24V', '富士電機', 4200, 'S2', '2026-05-12'],
    ['ブレーカ', 'NF32-SV 3P 20A', '三菱電機', 3100, 'S1', '2026-06-03'],
  ]
  hist.forEach(([name, model, maker, price, sup, date], i) => ws.purchases.push({ id: `PH${String(k2 + i + 1).padStart(4, '0')}`, name, model, maker, unit: '個', unitPrice: price, supplier: ws.suppliers.find((x) => x.id === sup)?.name ?? sup, date, qty: 2, note: '' }))
  return p.id
}
