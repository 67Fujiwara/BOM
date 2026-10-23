export type Role = 'design' | 'purchasing' | 'pm'
export const ROLE_LABEL: Record<Role, string> = { design: '設計', purchasing: '購買', pm: 'PM' }
export const ROLES: Role[] = ['design', 'purchasing', 'pm']

export interface User {
  name: string
  role: Role
}

/** 行の状態（行ごと）。案件全体の状態は行の集計 */
export type RowStatus =
  | 'draft' // 下書き
  | 'submitted' // 提出済
  | 'quoting' // 見積中
  | 'quoted' // 見積済
  | 'selected' // 選定済
  | 'formalRequested' // 正式依頼中
  | 'formalQuoted' // 正式見積済
  | 'ordered' // 発注済
  | 'received' // 入荷済
  | 'cancelled' // 取消（提出後の削除）
  | 'replaced' // 置換済

export const STATUS_LABEL: Record<RowStatus, string> = {
  draft: '下書き',
  submitted: '提出済',
  quoting: '見積中',
  quoted: '見積済',
  selected: '選定済',
  formalRequested: '正式依頼中',
  formalQuoted: '正式見積済',
  ordered: '発注済',
  received: '入荷済',
  cancelled: '取消',
  replaced: '置換済',
}
export const STATUS_ORDER: RowStatus[] = ['draft', 'submitted', 'quoting', 'quoted', 'selected', 'formalRequested', 'formalQuoted', 'ordered', 'received']

export type Unit = '個' | '本' | 'm' | 'セット' | 'パック' | '式'
export const UNITS: Unit[] = ['個', '本', 'm', 'セット', 'パック', '式']
export type Procurement = '相見積' | '客先指定品' | '指定商社' | '支給品' | '社内在庫'
export const PROCUREMENTS: Procurement[] = ['相見積', '客先指定品', '指定商社', '支給品', '社内在庫']
export type MakerLock = '指定' | '推奨' | '任意'
export const MAKER_LOCKS: MakerLock[] = ['指定', '推奨', '任意']
export type AltPolicy = '可' | '同等品可' | '不可' | '客先承認要'
export const ALT_POLICIES: AltPolicy[] = ['可', '同等品可', '不可', '客先承認要']

export type ChangeReason = '客先要求' | '設計起因' | '廃番・入手難' | 'コスト' | '納期' | '指摘対応' | 'その他'
export const CHANGE_REASONS: ChangeReason[] = ['客先要求', '設計起因', '廃番・入手難', 'コスト', '納期', 'その他']

export type AdoptReason = '納期' | '在庫即納' | '実績/品質' | '集約' | '客先指定' | 'その他'
export const ADOPT_REASONS: AdoptReason[] = ['納期', '在庫即納', '実績/品質', '集約', '客先指定', 'その他']

/** 行のフラグ（状態とは独立） */
export interface RowFlags {
  /** 再見積要（型式/メーカ変更・数量±20%超） */
  requote?: boolean
  /** PM承認待ち（例外選定・変更セット） */
  pmPending?: boolean
  /** 置換で引き継いだ見積の要再確認 */
  reconfirm?: boolean
  /** 納期NG */
  leadNG?: boolean
  /** 先行発注 */
  early?: boolean
  /** 代替承認待ち（客先承認要） */
  altPending?: boolean
  /** 正式見積の差分超過 */
  formalDiff?: boolean
  /** 対策区分（納期NGに PM が割当） */
  countermeasure?: '商社変更' | '代替品検討' | '分納・特急' | '受入'
  /** PM の再交渉で正式見積の回答待ち（回答が来るまで納期NG を PM に出し直さない） */
  renegotiating?: boolean
  /** 特急・分納の上限超過を PM が却下したときの追加費用（同じ額のあいだは PM の 7 に出さない） */
  capRuled?: number
  /** 発注後変更依頼を PM が承認した（購買が発注を取り消せる。§9.1） */
  orderCancelApproved?: boolean
  /** 単価要確認（数量変更が閾値内だが MOQ をまたぐ等） */
  priceCheck?: boolean
  /** 表記修正（正規化後の型式が同じ。見積は有効のまま） */
  notation?: boolean
  /** 発注数要確認 */
  orderQtyCheck?: boolean
  /** 取下げ・再発行対象（正式依頼中以降の変更） */
  reissue?: boolean
  /** 先行発注判断（PM） */
  ltbPending?: boolean
  /** 拮抗（一括採用で確定した拮抗行） */
  contested?: boolean
  /** 選定権限を購買に委譲（納期NG 対策） */
  delegated?: boolean
  /** 要決定に載っている理由 */
  pmReason?: '例外選定' | '先行採用' | '先行発注判断' | '変更セット' | '差分超過' | '納期NG' | '差戻し2回目' | '閾値超' | '再選定提案' | '対策不成立'
  /** 差分超過に PM が対応した時の「商社:正式単価」。同じ値の間は差分超過に戻さない */
  formalDiffKey?: string
  /** 見積回答の取り込みで型式が違った商社（購買が確認する） */
  importMismatch?: string
}

/** 設計が書く列（作業中コピーの対象） */
export interface DesignFields {
  ref: string
  drawing: string
  category: string
  name: string
  model: string
  maker: string
  qtyNeeded: number
  unit: Unit
  packQty: number | null
  procurement: Procurement
  makerLock: MakerLock
  altPolicy: AltPolicy
  /** 指定先（指定商社: 商社ID / 客先指定品: メーカ＋承認番号） */
  designated: string
  /** 必要日（行）: 案件必要日からの前倒し日数（負で前倒し）。needDateFixed なら絶対日付 */
  needOffset: number | null
  needDateFixed: string | null
  tags: string
  note: string
}
export const DESIGN_FIELDS: (keyof DesignFields)[] = ['ref', 'drawing', 'category', 'name', 'model', 'maker', 'qtyNeeded', 'unit', 'packQty', 'procurement', 'makerLock', 'altPolicy', 'designated', 'needOffset', 'needDateFixed', 'tags', 'note']

export interface Row extends DesignFields {
  id: string // R001〜 固定
  hidden: boolean
  status: RowStatus
  flags: RowFlags
  /** 発注数（購買。null なら必要数） */
  orderQty: number | null
  adoptedSupplierId?: string
  adoptReason?: string
  /** 選定時のスコア（固定） */
  scoreSnapshot?: number
  ordered: boolean
  received: boolean
  receivedLot?: string
  /** 追加費用（特急/送料/分納/その他） */
  extraCost: number | null
  extraCostKind: string
  /** 発注後の回答納期・入荷予定日 */
  promisedDate?: string
  /** 見積済になった日（納期スコアの基準日） */
  quotedAt?: string
  replacedBy?: string
  replaces?: string
  ackRules: string[]
  statusChangedAt: string
  /** 状態に紐づく期限 */
  dueAt?: string
  /** 最後に公開した Rev */
  publishedRev?: number
  /** 作業中（未公開）の設計列。公開済み以降の編集はここに積む */
  working?: Partial<DesignFields>
  /** PM 承認待ちの変更セット（承認されるまで公開値には反映しない） */
  pendingApproval?: Partial<DesignFields>
  pendingRev?: number
  /** 購買の先行発注の申請（PM の判断材料。設計の採用理由とは別に残す） */
  ltbRequest?: { reason: string; amount: number | null; by: string; at: string }
  /** 設計の作業中の取消・置換（公開するまで購買には「設計作業中」だけ見える） */
  removal?: Removal
  /** PM 承認待ちの取消・置換 */
  pendingRemoval?: Removal
  /** 指摘の提案から作られた行（その指摘 ID） */
  fromIssue?: string
  /** 公開済み差分の起因（指摘ID or 変更セットID） */
  lastChangeCause?: string
  /** 「あとで」にしたチェック */
  deferredRules: string[]
}

export type StockKind = '在庫' | '取寄' | '受注生産'
export interface Supplier {
  id: string
  name: string
  color: string
  order: number
  kind: '商社' | '直販'
  tradable: boolean
  avl: boolean
  handledMakers: string[]
  /** 実績（入荷記録から集計。null は実績なし＝中立50） */
  onTimeRate: number | null
  defectRate: number | null
}

export interface Quote {
  rowId: string
  supplierId: string
  unitPrice: number | null
  /** 日。0=即納、-1=辞退(取扱なし)、null=未回答 */
  leadDays: number | null
  moq: number | null
  stock: StockKind | null
  quoteQty: number | null
  validUntil: string | null
  note: string
  /** 出典: 手入力 / 取込 / 提案 I-0xx */
  source?: string
  /** 型式変更で無効化された旧型式の見積 */
  stale?: boolean
  staleModel?: string
  /** 要再確認の購買判断（据え置き / 再見積 / 提案値で確定） */
  reconfirm?: 'keep' | 'requote' | 'proposal'
  /** 要再確認の既定（提案商社＝提案値、他＝再見積） */
  reconfirmDefault?: 'keep' | 'requote' | 'proposal'
  /** 正式見積の依頼で送った必要納期（再発行時の差分シート用） */
  formalNeedDate?: string | null
  /** 再交渉前の正式単価 */
  prevFormalPrice?: number | null
  // 正式見積
  formalPrice: number | null
  formalLeadDays: number | null
  formalValidUntil: string | null
  formalDiffReason: string
  formalRequestNo?: string
}

export type IssueKind = '型式あいまい' | 'メーカ未記入' | '廃番' | '代替提案' | '最小ロット' | '数量見直し依頼' | '納期NG' | '質問' | 'コスト超過' | '発注後変更依頼' | 'その他'
export interface IssueKindDef {
  kind: IssueKind
  key: string // 頭文字
  resolver: Role
  approver?: Role
  dueDays: number
  /** 起票不可の調達区分 */
  blockedFor: Procurement[]
  /** 代替不可の行には起票不可 */
  blockedIfNoAlt?: boolean
}
export const ISSUE_KINDS: IssueKindDef[] = [
  { kind: '型式あいまい', key: 'k', resolver: 'design', dueDays: 1, blockedFor: ['客先指定品'] },
  { kind: 'メーカ未記入', key: 'm', resolver: 'design', dueDays: 1, blockedFor: [] },
  { kind: '廃番', key: 'd', resolver: 'design', approver: 'pm', dueDays: 3, blockedFor: [] },
  { kind: '代替提案', key: 'a', resolver: 'design', dueDays: 3, blockedFor: ['客先指定品'], blockedIfNoAlt: true },
  { kind: '最小ロット', key: 'l', resolver: 'purchasing', approver: 'pm', dueDays: 2, blockedFor: [] },
  { kind: '数量見直し依頼', key: 'r', resolver: 'design', dueDays: 2, blockedFor: [] },
  { kind: '納期NG', key: 'n', resolver: 'purchasing', approver: 'pm', dueDays: 1, blockedFor: [] },
  { kind: '質問', key: 'q', resolver: 'design', dueDays: 1, blockedFor: [] },
  { kind: 'コスト超過', key: 'c', resolver: 'design', approver: 'pm', dueDays: 2, blockedFor: [] },
  { kind: '発注後変更依頼', key: 'h', resolver: 'purchasing', approver: 'pm', dueDays: 1, blockedFor: [] },
  { kind: 'その他', key: 'o', resolver: 'design', dueDays: 2, blockedFor: [] },
]

export type IssueStatus = 'draft' | 'open' | 'inProgress' | 'fixed' | 'answered' | 'confirmed' | 'wontfix'
export const ISSUE_STATUS_LABEL: Record<IssueStatus, string> = { draft: '下書き', open: '未対応', inProgress: '対応中', fixed: '対応済', answered: '回答済', confirmed: '確認済', wontfix: '見送り' }

export interface IssueReply {
  by: User
  at: string
  text: string
}

export interface Issue {
  id: string // I-001〜
  rowId: string
  field?: keyof Row
  kind: IssueKind
  text: string
  proposal?: { model: string; maker: string; supplierId?: string; unitPrice?: number | null; leadDays?: number | null; moq?: number | null }
  by: User
  at: string
  rev?: number
  status: IssueStatus
  /** 設計の回答（直さず回答） */
  answer?: string
  answerKind?: '説明' | '客先承認取得'
  approvalRef?: { no: string; date: string }
  /** PM の決定 */
  decisionId?: string
  replies: IssueReply[]
  bounceCount: number
  /** 差戻し 2 回目を PM が裁定した */
  pmRuled?: boolean
  dueAt: string
  resolution?: string
  /** 対応先の行（置換時） */
  movedTo?: string
}

export type RuleType = 'required' | 'noWhitespace' | 'regex' | 'positive' | 'noFullWidth' | 'duplicate' | 'packMultiple' | 'altConsistent' | 'designated'
export interface Rule {
  id: string
  name: string
  field: keyof Row
  type: RuleType
  pattern?: string
  /** 適用条件（この正規表現に合う値だけ検査。例: ^CP30） */
  when?: string
  /** メーカ別の正規表現 */
  maker?: string
  severity: 'error' | 'warn'
  message: string
  fromIssueKind?: IssueKind
  owner: string
  scope: 'all' | string // 'all' or projectId
  enabled: boolean
}

export interface Submission {
  rev: number
  at: string
  by: User
  rowIds: string[]
  /** 差分の要約 */
  summary: { added: number; modelChanged: number; qtyChanged: number; other: number; cancelled: number }
  /** 変更セット（指摘対応でない変更があるとき） */
  changeSet?: { reason: ChangeReason; changeNo: string; approved?: boolean; decisionId?: string; rejected?: boolean }
  /** 却下などで取り消された Rev */
  revoked?: boolean
  /** 提出時のスナップショット（設計列） */
  snapshot: Record<string, DesignFields & { status: RowStatus }>
  /** 行ごとの起因 */
  causes: Record<string, string>
  /** 購買が確認済にした差分 */
  acked: string[]
}

export type DecisionKind = '承認' | '却下' | '次点商社へ' | '再交渉' | '設計へ代替依頼' | '数量見直し依頼' | '特急・分納' | '先行発注許可' | '受入' | '案件設定変更' | '対策区分' | '委譲' | '再選定' | '現状維持' | '指摘を支持' | '回答を支持' | '案件設定確定'
export interface Decision {
  id: string
  rowId?: string
  issueId?: string
  kind: DecisionKind
  by: User
  at: string
  reason: string
  /** ツール外決裁 */
  external?: { approver: string; date: string; ref: string }
  payload?: Record<string, unknown>
}

export interface ScoreWeights {
  price: number
  lead: number
  record: number
  terms: number
}

export interface EventLog {
  id: number
  at: string
  by: User
  rowId?: string
  text: string
  /** Undo 用。自分の操作だけ戻す */
  undoable?: boolean
}

export interface ProjectSettings {
  currency: string
  budget: number | null
  /** 社内工程日数（納期から逆算して必要日） */
  processDays: number
  tieThreshold: number
  exceptionAmount: number
  exceptionPct: number
  formalDiffPct: number
  formalDiffAmount: number
  qtyTolerancePct: number
  surplusAmount: number
  quoteCompleteRule: 'all' | 'min2' | 'deadline'
  quoteDeadline: string | null
  changeNeedsPmApproval: boolean
  selector: 'design' | 'purchasing'
  /** PM 項目の確定（重み・納期・予算） */
  pmConfirmed: boolean
  /** 上長決裁の条件 */
  externalApprovalAmount: number
  externalApprovalBudgetPct: number
  /** 回答期限の既定日数 / 正式見積の所要日数 */
  quoteDays: number
  formalDays: number
  /** 納期スコアの余裕幅（日） */
  leadMarginDays: number
  digestMail: boolean
  holidays: string[]
}

export interface Project {
  id: string
  name: string
  dueDate: string | null
  members: { design: string; purchasing: string; pm: string }
  preferredSupplierIds: string[]
  supplierIds: string[]
  rows: Row[]
  quotes: Quote[]
  issues: Issue[]
  submissions: Submission[]
  decisions: Decision[]
  weights: ScoreWeights
  rowWeights: Record<string, ScoreWeights>
  settings: ProjectSettings
  events: EventLog[]
  createdAt: string
  updatedAt: string
  version: number
  /** 概算/正式の依頼 Rev（商社ごと） */
  requestRevs: Record<string, number>
  nextIssueNo: number
  nextDecisionNo: number
  /** 案件レベルの要決定（案件設定確定など） */
  caseDecisions: Array<{ id: string; kind: '案件設定確定' | '予算超過'; status: 'open' | 'done'; at: string }>
}

export interface Workspace {
  user: User
  projects: Project[]
  suppliers: Supplier[]
  rules: Rule[]
  currentProjectId: string
}

export type Removal = { kind: 'cancel' } | { kind: 'replace'; by: string }
