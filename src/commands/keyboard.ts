import { useStore, userKey, type Panel, type State } from '@/model/store'
import { eventToKey, lookupBinding } from '@/keys/keymap'
import { colDef } from '@/model/columns'
import type { IssueKind } from '@/model/types'
import { ISSUE_KINDS } from '@/model/types'
import { isActive, ball as ballOf } from '@/model/derive'
import { scoreRow } from '@/model/score'
import { parseNumber } from '@/model/parse'
import * as issues from '@/actions/issues'
import * as adopt from '@/actions/adopt'
import * as pm from '@/actions/pm'
import * as rows from '@/actions/rows'
import { settingsFields } from '@/ui/settingsFields'
import { ROLE_DEFAULT_VIEW, cancelEdit, closePanel, colsForPanel, commitEdit, createProjectFromWizard, ensureCursor, gotoProblem, jumpToRow, moveCursorRow, openQuickfix, paletteItems, problemCells, prompt, runCommand, saveSettings, setView, startEdit, updateEditValue, validateSetting, validateWizardStep, visibleCursorRow } from './registry'

const st = () => useStore.getState()
const set = (p: Partial<State>) => useStore.setState(p)
const toast = (t: string, k: 'ok' | 'err' | 'info' = 'ok') => st().toastMsg(t, k)

/** 指摘パネルで選べる種別（役割ごと） */
export function issueKindsFor(): IssueKind[] {
  return issues.kindsForRole(st().user().role)
}

// ---------- パネルのキー処理 ----------
function handlePanelKey(key: string, e: KeyboardEvent): boolean {
  const s = st()
  const panel = s.panel!
  const p = s.project()
  const up = (n: number, len: number) => Math.max(0, Math.min(Math.max(len - 1, 0), n))
  const inText = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
  if (key === 'Escape') {
    if (panel.kind === 'wizard') {
      set({ wizardDraft: { step: panel.step, data: panel.data, sel: panel.sel, picks: panel.picks } })
      toast('新規BOMガイドを中止しました（入れた内容は残っています。Ctrl+K → 新しいBOM で続きから）', 'info')
    }
    if (panel.kind === 'settings' && panel.editing) {
      set({ panel: { ...panel, editing: false, error: undefined } })
      return true
    }
    // 保存していない変更があるときは、もう一度 Esc で捨てる
    if (panel.kind === 'settings' && Object.keys(panel.draft).length && !panel.discardArmed) {
      set({ panel: { ...panel, discardArmed: true } })
      toast(`保存していない変更が ${Object.keys(panel.draft).length} 件あります。Ctrl+Enter で保存、もう一度 Esc で変更を捨てて閉じます`, 'info')
      return true
    }
    if (panel.kind === 'settings' && Object.keys(panel.draft).length) toast('案件設定の変更を捨てました', 'info')
    closePanel()
    if (s.sequence) set({ sequence: false })
    return true
  }
  switch (panel.kind) {
    case 'palette': {
      const items = paletteItems(panel.query)
      if (key === 'ArrowDown') return (set({ panel: { ...panel, index: up(panel.index + 1, items.length) } }), true)
      if (key === 'ArrowUp') return (set({ panel: { ...panel, index: up(panel.index - 1, items.length) } }), true)
      if (key === 'PageDown') return (set({ panel: { ...panel, index: up(panel.index + 10, items.length) } }), true)
      if (key === 'PageUp') return (set({ panel: { ...panel, index: up(panel.index - 10, items.length) } }), true)
      if (key === 'Enter') {
        const it = items[panel.index]
        if (it) {
          set({ recentCommands: [it.id, ...s.recentCommands.filter((x) => x !== it.id)].slice(0, 20) })
          it.run()
        } else toast('該当する操作がありません（? でショートカット一覧）', 'info')
        return true
      }
      return key === 'Ctrl+K' ? (closePanel(), true) : false
    }
    case 'help':
    case 'history': {
      if (key === '?' || key === 'Enter' || key === 'Ctrl+K') return (closePanel(), key === 'Ctrl+K' && runCommand('palette.open'), true)
      // 一覧が画面に収まらないときはキーでスクロールする
      const body = document.querySelector<HTMLElement>('.overlay .dialog .body')
      if (body) {
        const step: Record<string, number> = { ArrowDown: 40, j: 40, ArrowUp: -40, k: -40, PageDown: body.clientHeight - 40, ' ': body.clientHeight - 40, PageUp: -(body.clientHeight - 40), 'Shift+ ': -(body.clientHeight - 40) }
        if (key === 'End') body.scrollTop = body.scrollHeight
        else if (key === 'Home') body.scrollTop = 0
        else if (step[key] !== undefined) body.scrollBy({ top: step[key] })
      }
      return true
    }
    case 'columns': {
      const cols = colsForPanel()
      if (key === 'ArrowDown') return (set({ panel: { ...panel, index: up(panel.index + 1, cols.length) } }), true)
      if (key === 'ArrowUp') return (set({ panel: { ...panel, index: up(panel.index - 1, cols.length) } }), true)
      if (key === ' ' || key === 'Enter') {
        const c = cols[panel.index]
        if (c === 'id' || c === 'name') return (toast('ID と部品名は隠せません', 'info'), true)
        set({ hiddenCols: s.hiddenCols.includes(c) ? s.hiddenCols.filter((x) => x !== c) : [...s.hiddenCols, c] })
        return true
      }
      return true
    }
    case 'issue': {
      const kinds = issueKindsFor()
      const defs = ISSUE_KINDS.filter((k) => kinds.includes(k.kind))
      if (panel.step === 'kind') {
        if (key === 'ArrowDown') return (set({ panel: { ...panel, index: up(panel.index + 1, defs.length) } }), true)
        if (key === 'ArrowUp') return (set({ panel: { ...panel, index: up(panel.index - 1, defs.length) } }), true)
        const def = key === 'Enter' ? defs[panel.index] : /^[1-9]$/.test(key) ? defs[Number(key) - 1] : defs.find((k) => k.key === key)
        if (def) {
          const row = p.rows.find((r) => r.id === panel.rowId)!
          const err = issues.canRaise(row, def.kind)
          if (err) return (toast(err, 'err'), true)
          set({ panel: { ...panel, step: 'text', issueKind: def.kind } })
          return true
        }
        if (key.length === 1 || /^Shift\+[A-Z]$/.test(key)) toast(`種別を選んでください: ${defs.map((d) => `${d.key} ${d.kind}`).join(' / ')}（↑↓ と Enter でも選べます）`, 'info')
        return true
      }
      const proposalKind = panel.issueKind === '廃番' || panel.issueKind === '代替提案'
      if (panel.step === 'text' && key === 'Tab') {
        if (!proposalKind) return (toast('提案欄は「廃番」「代替提案」のときだけ使います', 'info'), true)
        set({ panel: { ...panel, step: 'proposal' } })
        return true
      }
      if (panel.step === 'proposal' && (key === 'Tab' || key === 'Shift+Tab')) return false // 欄の移動はブラウザに任せる
      if (key === 'Enter' || key === 'Ctrl+Enter') {
        const kind = panel.issueKind as IssueKind
        const pr = panel.proposal
        let proposal: Parameters<typeof issues.raiseIssue>[4]
        if (pr.model.trim()) {
          const price = parseNumber(pr.unitPrice, { min: 0, label: '提案の単価' })
          const lead = parseNumber(pr.leadDays, { min: 0, max: 3650, integer: true, label: '提案の納期' })
          if (!price.ok) return (toast(price.error, 'err'), true)
          if (!lead.ok) return (toast(lead.error, 'err'), true)
          const sup = pr.supplierId.trim() ? s.ws.suppliers.find((x) => x.id.toLowerCase() === pr.supplierId.trim().toLowerCase() || x.name === pr.supplierId.trim()) : undefined
          if (pr.supplierId.trim() && !sup) return (toast(`商社「${pr.supplierId}」は商社マスタにありません（${s.ws.suppliers.map((x) => `${x.id} ${x.name}`).join(' / ')}）`, 'err'), true)
          proposal = { model: pr.model.trim(), maker: pr.maker.trim(), supplierId: sup?.id, unitPrice: price.value, leadDays: lead.value }
        } else if (pr.maker || pr.unitPrice || pr.leadDays || pr.supplierId) return (toast('提案の型式を入れてください', 'err'), true)
        const id = issues.raiseIssue(panel.rowId, panel.field, kind, panel.text, proposal)
        if (!id) return true
        closePanel()
        if (key === 'Ctrl+Enter') {
          // 連続起票: 次の行で同じ種別の本文入力から始める
          moveCursorRow(1)
          const next = visibleCursorRow()
          if (next && next.id !== panel.rowId) {
            runCommand('issue.raise')
            const np = st().panel
            if (np?.kind === 'issue' && !issues.canRaise(next, kind)) set({ panel: { ...np, step: 'text', issueKind: kind } })
            toast(`${id} ${kind} を下書きに追加。続けて ${next.id} の${kind}を書けます（Esc でやめる、最後に Ctrl+Enter で発行）`, 'ok')
            return true
          }
        }
        toast(`${id} ${kind} を下書きに追加しました。Ctrl+Enter（本文で）なら次の行へ続けて起票。最後に表で Ctrl+Enter で発行`, 'ok')
        return true
      }
      return false
    }
    case 'adopt': {
      const row = p.rows.find((r) => r.id === panel.rowId)!
      const scores = scoreRow(p, row, s.ws.suppliers)
      if (key === 'ArrowDown') return (set({ panel: { ...panel, index: up(panel.index + 1, scores.length) } }), true)
      if (key === 'ArrowUp') return (set({ panel: { ...panel, index: up(panel.index - 1, scores.length) } }), true)
      const n = /^[1-9]$/.test(key) ? Number(key) - 1 : key === 'Enter' ? panel.index : -1
      if (n >= 0 && scores[n]) {
        const sc = scores[n]
        closePanel()
        if (n === 0 && row.status !== 'quoting') adopt.adoptChoose(row.id, sc.supplierId)
        else prompt(row.status === 'quoting' ? '先行採用の理由（PM 承認待ちになります）。数字か ↑↓ で選び、補足があれば入れて Enter' : '1位以外を選ぶ理由。数字か ↑↓ で選び、補足があれば入れて Enter', { options: [...adopt.ADOPT_REASONS], index: -1, placeholder: '補足（任意）', showText: true, digitsSelect: true }, (c, t) => void adopt.adoptChoose(row.id, sc.supplierId, (c ?? 'その他') + (t ? `: ${t}` : '')))
        return true
      }
      if (n >= 0 || key.length === 1) toast(`1〜${scores.length} で商社を選んでください`, 'info')
      return true
    }
    case 'prompt': {
      const n = panel.options?.length ?? 0
      const submit = (choice: string | null) => {
        // 既定の無い選択（理由など）は、選ぶまで進めない（Enter 連打で理由が勝手に決まらないように）
        if (panel.options && choice == null) {
          set({ panel: { ...panel, error: '選んでください' } })
          return toast(`数字（1〜${n}）か ↑↓ で選んでから Enter`, 'err')
        }
        if (panel.requireText && !panel.text.trim()) {
          set({ panel: { ...panel, error: '入力は必須です' } })
          return toast('入力は必須です', 'err')
        }
        closePanel()
        const err = panel.onSubmit(choice, panel.text, panel.extra)
        if (typeof err === 'string') {
          // エラーなら入れた内容を残したままダイアログを開き直す
          set({ panel: { ...panel, error: err }, mode: 'panel' })
          toast(err, 'err')
        }
      }
      // 文字欄が無い、または理由の選択で文字欄が空のときは数字キーで選ぶ
      const digitPick = panel.options && /^[1-9]$/.test(key) && (!panel.showText || (panel.digitsSelect && !panel.text))
      if (digitPick) {
        if (Number(key) > n) return (toast(`1〜${n} で選んでください`, 'info'), true)
        if (panel.showText && panel.requireText) return (set({ panel: { ...panel, index: Number(key) - 1 } }), true)
        submit(panel.options![Number(key) - 1])
        return true
      }
      if (key === 'ArrowDown' && panel.options) return (set({ panel: { ...panel, index: up(panel.index + 1, n) } }), true)
      if (key === 'ArrowUp' && panel.options) return (set({ panel: { ...panel, index: up(panel.index - 1, n) } }), true)
      if (key === 'Enter') {
        submit(panel.options ? (panel.options[panel.index] ?? null) : null)
        return true
      }
      // Ctrl+Enter の押し直しで、選択肢を読まずに確定しない
      if (key === 'Ctrl+Enter') return (toast('選んで Enter で確定します（Esc で取り消し）', 'info'), true)
      if (!panel.showText && !panel.extra && key.length === 1) return (toast(panel.options ? `↑↓ と Enter、または 1〜${n} で選んでください` : 'Enter で確定、Esc で取り消し', 'info'), true)
      return false
    }
    case 'quickfix':
    case 'rule':
    case 'export':
    case 'consolidate': {
      const opts = panel.options as Array<{ label: string; run: () => void; key?: string }>
      if (key === 'ArrowDown') return (set({ panel: { ...panel, index: up(panel.index + 1, opts.length) } }), true)
      if (key === 'ArrowUp') return (set({ panel: { ...panel, index: up(panel.index - 1, opts.length) } }), true)
      if (!opts.length) return key === 'Enter' ? (closePanel(), true) : true
      let idx = key === 'Enter' ? panel.index : -1
      if (idx < 0) idx = opts.findIndex((o) => o.key === key)
      // キーの決まった選択肢（決定パネルの y / b / g …）では、数字を並び順の選択に使わない
      if (idx < 0 && /^[1-9]$/.test(key) && !opts.some((o) => o.key && !/^\d$/.test(o.key))) idx = Number(key) - 1
      if (idx >= 0 && opts[idx]) {
        closePanel()
        opts[idx].run()
        if (s.sequence && panel.kind === 'quickfix')
          setTimeout(() => {
            if (problemCells().length && gotoProblem(1) && visibleCursorRow()) openQuickfix()
            else {
              set({ sequence: false })
              toast('順番に直すモード: 残りの問題はありません', 'ok')
            }
          }, 0)
        return true
      }
      if (key.length === 1 || /^Shift\+/.test(key)) toast(opts.some((o) => o.key) ? `使えるキー: ${opts.map((o) => o.key).filter(Boolean).join(' / ')}（↑↓ と Enter でも選べます）` : `1〜${Math.min(9, opts.length)} か ↑↓ と Enter で選んでください`, 'info')
      return true
    }
    case 'impact':
      if (key === 'Enter') {
        closePanel()
        panel.onConfirm()
      }
      return true
    case 'import':
      if (key === 'Ctrl+Enter') {
        closePanel()
        panel.onSubmit(panel.text)
        return true
      }
      return false
    case 'replyIssue':
      if (key === 'Enter') {
        if (!panel.text.trim()) return (toast('返信を入れてください', 'info'), true)
        closePanel()
        issues.replyIssue(panel.issueId, panel.text)
        toast('返信しました（相手の受信箱に出ます）', 'ok')
        return true
      }
      return false
    case 'inbox': {
      const q = panel.query.toLowerCase()
      const list = s.ws.projects.filter((x) => !q || (x.id + x.name).toLowerCase().includes(q))
      const total = list.length + 1
      if (key === 'ArrowDown') return (set({ panel: { ...panel, index: up(panel.index + 1, total) } }), true)
      if (key === 'ArrowUp') return (set({ panel: { ...panel, index: up(panel.index - 1, total) } }), true)
      if (key === 'Enter') {
        if (q && !list.length) return (toast(`「${panel.query}」に当たる案件はありません（新しく作るときは ↓ で「＋ 新しいBOM」を選んで Enter）`, 'info'), true)
        if (panel.index >= list.length) {
          closePanel()
          runCommand('project.new')
          return true
        }
        const target = list[panel.index]
        closePanel()
        st().commitWs('', (ws) => void (ws.currentProjectId = target.id))
        const p2 = st().project()
        const role = st().user().role
        set({ filter: '', cellFilter: null, openRows: [], sort: null, cursorRow: null })
        setView(ROLE_DEFAULT_VIEW[role])
        const first = p2.rows.find((r) => isActive(r) && ballOf(p2, r) === role)
        if (first) jumpToRow(first.id)
        toast(`${target.name} を開きました${first ? `（あなた宛の最初の行 ${first.id}）` : ''}`, 'info')
        return true
      }
      return false
    }
    case 'settings': {
      if (panel.discardArmed) {
        set({ panel: { ...panel, discardArmed: false } })
        return handlePanelKey(key, e)
      }
      const fields = settingsFields(p)
      if (panel.editing) {
        if (key === 'Enter') {
          const f = fields[panel.index]
          const err = validateSetting(f.key, panel.value, p)
          if (err) {
            set({ panel: { ...panel, error: err } })
            toast(err, 'err')
            return true
          }
          set({ panel: { ...panel, editing: false, error: undefined, draft: { ...panel.draft, [f.key]: panel.value } } })
          return true
        }
        return false
      }
      if (key === 'ArrowDown') return (set({ panel: { ...panel, index: up(panel.index + 1, fields.length) } }), true)
      if (key === 'ArrowUp') return (set({ panel: { ...panel, index: up(panel.index - 1, fields.length) } }), true)
      if (key === 'Enter') {
        const f = fields[panel.index]
        const role = s.user().role
        if ((f.owner === 'PM' && role !== 'pm') || (f.owner === '購買' && role === 'design')) return (toast(`権限なし（${f.label} は ${f.owner} 項目）`, 'err'), true)
        return (set({ panel: { ...panel, editing: true, error: undefined, value: panel.draft[f.key] ?? f.value } }), true)
      }
      if (key === 'Ctrl+Enter' || key === 'Ctrl+S') return (saveSettings(panel.draft), true)
      if (key === 'y') {
        if (s.user().role !== 'pm') return (toast('権限なし（確定は PM）', 'err'), true)
        if (Object.keys(panel.draft).length) return (toast('変更があります。先に Ctrl+Enter で保存してから y で確定してください', 'info'), true)
        pm.confirmSettings()
        closePanel()
        toast('案件設定を確定しました', 'ok')
        return true
      }
      return true
    }
    case 'weights': {
      const keys = ['price', 'lead', 'record', 'terms'] as const
      if (key === 'ArrowDown') return (set({ panel: { ...panel, index: up(panel.index + 1, 4) } }), true)
      if (key === 'ArrowUp') return (set({ panel: { ...panel, index: up(panel.index - 1, 4) } }), true)
      if (key === 'ArrowLeft' || key === 'ArrowRight') {
        const d = key === 'ArrowLeft' ? -5 : 5
        const cur = { ...(p.rowWeights[panel.rowId] ?? p.weights) }
        const nv = Math.max(0, Math.min(100, cur[keys[panel.index]] + d))
        if (nv === cur[keys[panel.index]]) return true
        cur[keys[panel.index]] = nv
        if (cur.price + cur.lead + cur.record + cur.terms === 0) return (toast('重みをすべて 0 にはできません', 'info'), true)
        s.commit('行の重みを変更', (p2) => void (p2.rowWeights[panel.rowId] = cur), { rowId: panel.rowId })
        return true
      }
      if (key === 'Delete' || key === 'Backspace') {
        s.commit('行の重みを既定に戻す', (p2) => void delete p2.rowWeights[panel.rowId], { rowId: panel.rowId })
        toast('この行の重みを案件の既定に戻しました', 'info')
        return true
      }
      return true
    }
    case 'wizard':
      return handleWizardKey(panel, key, e, inText)
  }
}

function handleWizardKey(panel: Extract<Panel, { kind: 'wizard' }>, key: string, e: KeyboardEvent, inText: boolean): boolean {
  const s = st()
  const n = s.ws.suppliers.length
  const up = (x: number, len: number) => Math.max(0, Math.min(len - 1, x))
  const go = (step: number) => set({ panel: { ...panel, step, error: undefined } })
  if (key === 'Alt+ArrowLeft') return (go(Math.max(0, panel.step - 1)), true)
  const inTextarea = e.target instanceof HTMLTextAreaElement
  if (panel.step === 6) {
    if (key === 'ArrowDown') return (set({ panel: { ...panel, sel: up(panel.sel + 1, n) } }), true)
    if (key === 'ArrowUp') return (set({ panel: { ...panel, sel: up(panel.sel - 1, n) } }), true)
    if (key === ' ') {
      const id = s.ws.suppliers[panel.sel].id
      return (set({ panel: { ...panel, picks: panel.picks.includes(id) ? panel.picks.filter((x) => x !== id) : [...panel.picks, id] } }), true)
    }
  }
  if (panel.step === 7 && !inTextarea) {
    if (/^[1-3]$/.test(key)) {
      set({ panel: { ...panel, sel: Number(key) - 1, data: { ...panel.data, inputMode: String(Number(key) - 1) }, error: undefined } })
      setTimeout(() => {
        if (key === '1') document.querySelector<HTMLTextAreaElement>('[data-testid="wizard-paste"]')?.focus()
        if (key === '2') document.querySelector<HTMLInputElement>('[data-testid="wizard-file"]')?.focus()
      }, 0)
      return true
    }
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      const sel = up(panel.sel + (key === 'ArrowDown' ? 1 : -1), 3)
      return (set({ panel: { ...panel, sel, data: { ...panel.data, inputMode: String(sel) } } }), true)
    }
  }
  const next = key === 'Ctrl+Enter' || (key === 'Enter' && !inTextarea)
  if (next) {
    const data = panel.step === 7 ? { ...panel.data, inputMode: panel.data.inputMode ?? String(panel.sel) } : panel.data
    const err = validateWizardStep(panel.step, data)
    if (err) {
      set({ panel: { ...panel, data, error: err } })
      toast(err, 'err')
      return true
    }
    if (panel.step < 8) {
      set({ panel: { ...panel, data, step: panel.step + 1, error: undefined, sel: panel.step + 1 === 6 ? 0 : panel.step + 1 === 7 ? Number(data.inputMode ?? 0) : panel.sel } })
      return true
    }
    createProjectFromWizard(data, panel.picks)
    return true
  }
  void inText
  return false
}

// ---------- 英字を続けて打ったときの扱い ----------
// 編集できるセルで英字を打つと、1 文字目が a/h/o などのコマンドとして動いてしまう。
// 直後（BURST_MS 以内）に続けて文字が来たら「入力していた」とみなし、コマンドを取り消して上書き編集にする。
const BURST_MS = 350
const UI_KEYS = ['cursorRow', 'cursorCol', 'view', 'sort', 'filter', 'cellFilter', 'collapsed', 'openRows', 'detailIndex', 'revView'] as const
type Burst = { at: number; text: string; ui: Partial<State>; undoLen: number; row: string; col: string }
let burst: Burst | null = null
/** 続けて押しても移動とみなすキー（j j k / x n など） */
const NAV_LETTERS = new Set(['j', 'k', 'n'])
const undoLen = () => (st().undo[userKey(st().ws.user)] ?? []).length
function printable(e: KeyboardEvent): boolean {
  return e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey
}
function beginBurst(ch: string) {
  const s = st()
  const ui: Partial<State> = {}
  for (const k of UI_KEYS) (ui as Record<string, unknown>)[k] = s[k]
  burst = { at: performance.now(), text: ch, ui, undoLen: undoLen(), row: s.cursorRow ?? '', col: s.cursorCol }
}
/** 続けて打たれた文字なら、前のコマンドを取り消して上書き編集を始める */
function resolveBurst(e: KeyboardEvent, key: string): boolean {
  const b = burst
  if (!b || performance.now() - b.at > BURST_MS || !printable(e) || e.key === ' ') return false
  const binding = lookupBinding(key, 'nav')
  // 移動キー（j k n）の後・同じキーの連打は、割り当てのあるキーならそのまま実行する。
  // それ以外は、200ms 以内に続いた文字を入力とみなす（割り当ての無い文字なら BURST_MS 以内）
  const first = b.text.at(-1) ?? ''
  if (binding && (NAV_LETTERS.has(first) || NAV_LETTERS.has(e.key) || e.key === first || performance.now() - b.at > 200)) {
    burst = null
    return false
  }
  e.preventDefault()
  burst = null
  if (st().panel) closePanel()
  if (st().mode === 'edit') cancelEdit()
  if (undoLen() > b.undoLen) st().undoLast()
  set({ ...b.ui, cursorRow: b.row, cursorCol: b.col })
  if (rows.canEdit(b.col)) return true
  startEdit(b.text + e.key)
  toast(`続けて打たれたので「${b.text}」はコマンドではなく文字の入力として扱いました`, 'info')
  return true
}

// ---------- 全体のキー処理 ----------
export function handleKeyDown(e: KeyboardEvent) {
  if (e.isComposing || e.key === 'Process' || e.keyCode === 229) return // 日本語入力の変換中は何もしない
  const key = eventToKey(e)
  if (resolveBurst(e, key)) return
  const s = st()
  const target = e.target as HTMLElement | null
  const inInput = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
  // 「戻る」（Alt+← / Alt+→ / Cmd+[ ]）や Ctrl+G 検索などのブラウザ既定動作は、どの場面でも止める（入力中の内容を失わない）
  if (/^(Alt\+Arrow(Left|Right)|Ctrl\+\[|Ctrl\+\]|Ctrl\+G|Ctrl\+Shift\+[CF]|Ctrl\+\.|Ctrl\+Shift\+\.|Ctrl\+P|Ctrl\+S|Ctrl\+E)$/.test(key) || (key === 'Ctrl+A' && !inInput)) e.preventDefault()
  // ヘッダーのボタンなどにフォーカスがあるときの Space/Enter は表の操作として扱う（ボタンを二度押さない）
  if (target instanceof HTMLButtonElement && (key === ' ' || key === 'Enter')) {
    e.preventDefault()
    target.blur()
  }
  // 絞り込み入力中
  if (inInput && target?.classList.contains('filter') && !s.panel) {
    const input = target as HTMLInputElement
    if (key === 'Escape') {
      e.preventDefault()
      if (input.value) set({ filter: '' })
      input.blur()
      document.querySelector<HTMLElement>('.gridwrap')?.focus()
      return
    }
    if (key === 'Enter' || key === 'ArrowDown') {
      e.preventDefault()
      input.blur()
      document.querySelector<HTMLElement>('.gridwrap')?.focus()
      ensureCursor()
      if (!st().cursorRow) toast(`「${input.value}」に合う行はありません（Esc で解除）`, 'info')
      return
    }
    if (key === '/' && !input.value) return e.preventDefault()
    if (['Ctrl+K', 'Ctrl+P', 'Ctrl+Enter', 'Ctrl+E', 'Ctrl+G', 'Ctrl+S'].includes(key)) {
      e.preventDefault()
      input.blur()
      document.querySelector<HTMLElement>('.gridwrap')?.focus()
      runCommand(lookupBinding(key, 'nav')!.id, e)
    }
    return
  }
  if (s.panel) {
    if (handlePanelKey(key, e)) {
      e.preventDefault()
      return
    }
    if (key === 'Tab' || key === 'Shift+Tab') {
      // フォーカスはダイアログの中で回す（外に出て背後の表・絞り込み欄に打鍵が入らないように）
      e.preventDefault()
      const dlg = document.querySelector<HTMLElement>('.overlay .dialog')
      const fs = dlg ? [...dlg.querySelectorAll<HTMLElement>('input:not([type=file]), textarea, select, button')].filter((x) => !x.hasAttribute('disabled') && x.offsetParent !== null) : []
      if (fs.length) {
        const i = fs.indexOf(document.activeElement as HTMLElement)
        fs[(i + (key === 'Tab' ? 1 : -1) + fs.length) % fs.length].focus()
      }
      return
    }
    // 「迷ったら Ctrl+K」はどのダイアログの中でも効く（ガイドの途中の内容は残す）
    if (key === 'Ctrl+K') {
      e.preventDefault()
      const panel = s.panel
      if (panel.kind === 'wizard') set({ wizardDraft: { step: panel.step, data: panel.data, sel: panel.sel, picks: panel.picks } })
      closePanel()
      runCommand('palette.open')
      return
    }
    if (key === 'Ctrl+S' || key === 'Ctrl+P' || key === 'Ctrl+E' || key === 'Ctrl+G') e.preventDefault()
    return
  }
  if (s.mode === 'edit') {
    switch (key) {
      case 'Enter':
        e.preventDefault()
        commitEdit('down')
        return
      case 'Tab':
        e.preventDefault()
        commitEdit('right')
        return
      case 'Shift+Tab':
        e.preventDefault()
        commitEdit('left')
        return
      case 'Escape':
        e.preventDefault()
        return cancelEdit()
      case 'ArrowDown':
      case 'ArrowUp': {
        const c = s.editCandidates
        if (c && c.length > 1) {
          e.preventDefault()
          const rot = key === 'ArrowDown' ? [...c.slice(1), c[0]] : [c[c.length - 1], ...c.slice(0, -1)]
          set({ editCandidates: rot })
        }
        return
      }
    }
    // 入力欄にフォーカスが移る前に打たれた文字は取りこぼさない
    if (printable(e) && !(target instanceof HTMLInputElement && target.classList.contains('cell'))) {
      e.preventDefault()
      updateEditValue(s.editValue + e.key)
      return
    }
    // 編集中のグローバルキー: 確定してから実行（Ctrl+Z はブラウザの入力欄の取り消しに任せる）
    if (['Ctrl+K', 'Ctrl+S', 'Ctrl+Enter', 'Ctrl+E', 'Ctrl+P', 'Ctrl+G', 'Ctrl+Shift+C', 'Ctrl+.', 'Ctrl+Shift+F'].includes(key)) {
      e.preventDefault()
      const b = lookupBinding(key, 'nav')
      if (b && commitEdit('stay')) runCommand(b.id, e)
    }
    return
  }
  if (inInput) return
  // ナビモード
  const b = lookupBinding(key, 'nav')
  if (b) {
    if (b.id === 'cell.copy' && window.getSelection()?.toString()) return
    e.preventDefault()
    if (b.id.startsWith('view.')) {
      const d = colDef(s.cursorCol)
      if (s.cursorRow && d?.numeric && !rows.canEdit(s.cursorCol)) toast(`数字キーはビュー切替です。${d.label}に数値を入れるときは Enter か F2 で編集してから打ってください${s.view === 6 || s.view === 8 ? '（6・8 では確定後の Enter / Tab で次のセルの入力が続きます）' : ''}`, 'info')
    }
    const letter = /^[a-z]$/.test(key)
    const editable = letter && !!visibleCursorRow() && !rows.canEdit(s.cursorCol)
    if (editable) beginBurst(e.key)
    else burst = null
    runCommand(b.id, e)
    return
  }
  burst = null
  // 割り当ての無い文字 → 上書き編集（Excel と同じ）
  const ch = e.key
  if (ch.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault()
    const r = visibleCursorRow()
    if (!r) return toast('行を選んでください（↓ で先頭の行へ）', 'info')
    const err = rows.canEdit(s.cursorCol)
    if (err) return toast(`${err}（Tab / ← → で編集できる列へ）`, 'info')
    startEdit(ch)
  }
}

export { moveCursorRow }
