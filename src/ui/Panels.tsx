import { useEffect, useRef } from 'react'
import { useStore, type Panel } from '@/model/store'
import { KEYMAP, formatKey } from '@/keys/keymap'
import { COLUMNS } from '@/model/columns'
import { ROLE_LABEL, ISSUE_KINDS } from '@/model/types'
import { paletteItems } from '@/commands/registry'
import { ballCounts, effective, fmtYen } from '@/model/derive'
import { scoreRow } from '@/model/score'
import { fmtDateTime } from '@/model/dates'

export function Panels() {
  const st = useStore()
  const panel = st.panel
  if (!panel) return null
  return (
    <div className="overlay" data-testid={`panel-${panel.kind}`} onMouseDown={(e) => { if (e.target === e.currentTarget) st.set({ panel: null, mode: 'nav' }) }}>
      <PanelBody panel={panel} />
    </div>
  )
}

function Foot({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="foot">
      {items.map(([k, l]) => (
        <span key={k}>
          <kbd>{formatKey(k)}</kbd> {l}
        </span>
      ))}
    </div>
  )
}

function AutoInput({ value, onChange, placeholder, testid, multiline }: { value: string; onChange: (v: string) => void; placeholder?: string; testid?: string; multiline?: boolean }) {
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])
  if (multiline) return <textarea ref={ref} className="f" rows={8} data-testid={testid} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
  return <input ref={ref} className="q" data-testid={testid} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
}

function PanelBody({ panel }: { panel: Panel }) {
  const st = useStore()
  const p = st.project()
  switch (panel.kind) {
    case 'palette': {
      const items = paletteItems(panel.query)
      return (
        <div className="dialog" role="dialog" aria-label="コマンドパレット">
          <AutoInput value={panel.query} onChange={(v) => st.set({ panel: { ...panel, query: v, index: 0 } })} placeholder="操作・行ID・案件名を入力（例: R034 採用、ビュー 要確認、公開）" testid="palette-input" />
          <div className="list" data-testid="palette-list">
            {items.slice(0, 40).map((it, i) => (
              <div key={it.id + i} className="item" aria-selected={i === panel.index} onMouseEnter={() => st.set({ panel: { ...panel, index: i } })} onClick={() => it.run()}>
                <span className="sec">{it.section}</span>
                <span>{it.label}</span>
                {it.desc && <span className="desc">{it.desc}</span>}
                <span className="keys">
                  {it.keys?.map((k) => (
                    <kbd key={k}>{formatKey(k)}</kbd>
                  ))}
                </span>
              </div>
            ))}
            {items.length === 0 && <div className="item muted">該当する操作がありません</div>}
          </div>
          <Foot items={[['Enter', '実行'], ['Escape', '閉じる'], ['ArrowUp', '選択'], ['ArrowDown', '選択']]} />
        </div>
      )
    }
    case 'help': {
      const sections = [...new Set(KEYMAP.map((b) => b.section))]
      return (
        <div className="dialog wide" role="dialog" aria-label="ショートカット一覧">
          <div className="body">
            <h3 style={{ margin: '0 0 10px' }}>ショートカット一覧</h3>
            <div className="help-cols" data-testid="help">
              {sections.map((sec) => (
                <section key={sec}>
                  <h4>{sec}</h4>
                  {KEYMAP.filter((b) => b.section === sec).map((b) => (
                    <div className="r" key={b.id}>
                      <span>{b.label}</span>
                      <span className="ks">
                        {b.keys.map((k) => (
                          <kbd key={k}>{formatKey(k)}</kbd>
                        ))}
                      </span>
                    </div>
                  ))}
                </section>
              ))}
              <section>
                <h4>要決定（7 ビュー・PM）</h4>
                {[['y', '承認 / 受入 / 許可'], ['Shift+Y', '却下 / 受入（遅延許容）/ 現状維持'], ['Enter', '決定パネル（b 次点 / g 再交渉 / d 設計へ代替依頼 / q 数量見直し / e 特急・分納 / p 委譲）']].map(([k, l]) => (
                  <div className="r" key={k}>
                    <span>{l}</span>
                    <span className="ks">
                      <kbd>{formatKey(k)}</kbd>
                    </span>
                  </div>
                ))}
              </section>
              <section>
                <h4>指摘パネル（Space で開いて ↓ で選択）</h4>
                {[['Enter', '指摘アクション（1 返信 / 2 直さず回答 / 3 客先承認取得 / 4 提案を適用 / 5 ルール化 / 6 見送り / 7 代替なし）'], ['Shift+R', '返信']].map(([k, l]) => (
                  <div className="r" key={k}>
                    <span>{l}</span>
                    <span className="ks">
                      <kbd>{formatKey(k)}</kbd>
                    </span>
                  </div>
                ))}
              </section>
            </div>
          </div>
          <Foot items={[['Escape', '閉じる']]} />
        </div>
      )
    }
    case 'columns': {
      const cols = COLUMNS.filter((c) => !c.perSupplier)
      return (
        <div className="dialog" role="dialog" aria-label="列の表示">
          <div className="body panel-list" data-testid="columns">
            <h3 style={{ margin: '0 0 8px' }}>列の表示</h3>
            {cols.map((c, i) => (
              <div key={c.key} className="opt" aria-selected={i === panel.index}>
                <span className="check">{st.hiddenCols.includes(c.key) ? '○' : '●'}</span>
                <span>{c.label}</span>
                <span className="muted" style={{ marginLeft: 'auto' }}>{c.editableBy.map((r) => ROLE_LABEL[r]).join('・') || '自動'}</span>
              </div>
            ))}
          </div>
          <Foot items={[['ArrowUp', '選択'], ['ArrowDown', '選択'], [' ', '表示切替'], ['Escape', '閉じる']]} />
        </div>
      )
    }
    case 'issue': {
      const row = p.rows.find((r) => r.id === panel.rowId)
      return (
        <div className="dialog" role="dialog" aria-label="指摘を起票">
          <div className="body">
            <h3 style={{ margin: '0 0 8px' }}>
              指摘を起票 <span className="muted">{panel.rowId} {row ? effective(row).name : ''} [{panel.field}]</span>
            </h3>
            {panel.step === 'kind' && (
              <div className="panel-list" data-testid="issue-kinds">
                {ISSUE_KINDS.filter((k) => k.kind !== '納期NG' && k.kind !== 'コスト超過').map((k) => (
                  <div key={k.kind} className="opt" aria-selected={panel.issueKind === k.kind}>
                    <kbd>{k.key}</kbd> <span>{k.kind}</span>
                    <span className="muted" style={{ marginLeft: 'auto' }}>担当 {ROLE_LABEL[k.resolver]} / 期限 {k.dueDays} 営業日</span>
                  </div>
                ))}
              </div>
            )}
            {panel.step === 'text' && (
              <>
                <div className="muted" style={{ marginBottom: 6 }}>種別: {panel.issueKind}</div>
                <AutoInput value={panel.text} onChange={(v) => st.set({ panel: { ...panel, text: v } })} placeholder="本文（Enter で起票、Tab で提案欄へ）" testid="issue-text" />
              </>
            )}
            {panel.step === 'proposal' && (
              <div className="wizard">
                <div className="muted">提案（型式 / メーカ / 商社 / 単価 / 納期）。Tab で次へ、Enter で起票</div>
                {(['model', 'maker', 'supplierId', 'unitPrice', 'leadDays'] as const).map((k, i) => (
                  <label key={k}>
                    {['提案型式', '提案メーカ', '商社ID（S1〜）', '単価', '納期(日)'][i]}
                    <input className="f" data-testid={`proposal-${k}`} value={panel.proposal[k]} onChange={(e) => st.set({ panel: { ...panel, proposal: { ...panel.proposal, [k]: e.target.value } } })} autoFocus={i === 0} />
                  </label>
                ))}
              </div>
            )}
          </div>
          <Foot items={panel.step === 'kind' ? [['k', '型式あいまい'], ['m', 'メーカ未記入'], ['d', '廃番'], ['a', '代替提案'], ['l', '最小ロット'], ['q', '質問'], ['Escape', '閉じる']] : [['Enter', '起票（下書き）'], ['Tab', '提案欄'], ['Escape', '閉じる']]} />
        </div>
      )
    }
    case 'adopt': {
      const row = p.rows.find((r) => r.id === panel.rowId)!
      const scores = scoreRow(p, row, st.ws.suppliers)
      return (
        <div className="dialog" role="dialog" aria-label="商社を選んで採用">
          <div className="body panel-list" data-testid="adopt">
            <h3 style={{ margin: '0 0 8px' }}>
              商社を選んで採用 <span className="muted">{row.id} {effective(row).name}</span>
            </h3>
            {scores.map((sc, i) => (
              <div key={sc.supplierId} className="opt" aria-selected={i === panel.index}>
                <kbd>{i + 1}</kbd>
                <span className="supplier-dot" style={{ background: st.ws.suppliers.find((s) => s.id === sc.supplierId)?.color }} />
                <span>{st.ws.suppliers.find((s) => s.id === sc.supplierId)?.name}</span>
                <span className="muted">
                  {fmtYen(sc.quote.unitPrice, p.settings.currency)} / {sc.quote.stock === '在庫' ? '即納' : `${sc.quote.leadDays}日`} / スコア {sc.total} {sc.reasons.join('・')}
                </span>
              </div>
            ))}
            {scores.length === 0 && <div className="muted">有効な見積がありません</div>}
          </div>
          <Foot items={[['1', '〜9 で選ぶ'], ['Enter', '採用'], ['Escape', '閉じる']]} />
        </div>
      )
    }
    case 'prompt':
      return (
        <div className="dialog" role="dialog" aria-label={panel.title}>
          <div className="body">
            <h3 style={{ margin: '0 0 8px' }}>{panel.title}</h3>
            {panel.options && (
              <div className="panel-list" data-testid="prompt-options">
                {panel.options.map((o, i) => (
                  <div key={o} className="opt" aria-selected={i === panel.index}>
                    <kbd>{i + 1}</kbd> <span>{o}</span>
                  </div>
                ))}
              </div>
            )}
            {(panel.requireText || !panel.options) && <AutoInput value={panel.text} onChange={(v) => st.set({ panel: { ...panel, text: v } })} placeholder={panel.placeholder ?? '理由・本文（Enter で確定）'} testid="prompt-text" />}
            {panel.extra && (
              <div className="wizard">
                {Object.entries(panel.extra).map(([k, v]) => (
                  <label key={k}>
                    {k}
                    <input className="f" data-testid={`extra-${k}`} value={v} onChange={(e) => st.set({ panel: { ...panel, extra: { ...panel.extra, [k]: e.target.value } } })} />
                  </label>
                ))}
              </div>
            )}
          </div>
          <Foot items={[['Enter', '確定'], ['Escape', '取り消し']]} />
        </div>
      )
    case 'quickfix':
    case 'rule':
    case 'export':
      return (
        <div className="dialog" role="dialog" aria-label="候補">
          <div className="body panel-list" data-testid="quickfix">
            <h3 style={{ margin: '0 0 8px' }}>{panel.kind === 'export' ? 'Excel 出力先' : panel.kind === 'rule' ? 'ルールを追加' : `直し方の候補 ${'rowId' in panel ? panel.rowId : ''}`}</h3>
            {panel.options.map((o, i) => (
              <div key={o.label + i} className="opt" aria-selected={i === panel.index}>
                <kbd>{i + 1}</kbd> <span>{o.label}</span>
              </div>
            ))}
            {panel.options.length === 0 && <div className="muted">候補がありません</div>}
          </div>
          <Foot items={[['Enter', '実行'], ['Escape', '閉じる']]} />
        </div>
      )
    case 'consolidate':
      return (
        <div className="dialog wide" role="dialog" aria-label="商社を集約">
          <div className="body panel-list">
            <h3 style={{ margin: '0 0 8px' }}>商社を集約（試算）</h3>
            {panel.options.map((o, i) => (
              <div key={o.label} className="opt" aria-selected={i === panel.index}>
                <kbd>{i + 1}</kbd> <span>{o.label}</span> <span className="muted">{o.detail}</span>
              </div>
            ))}
          </div>
          <Foot items={[['Enter', '適用'], ['Escape', '閉じる']]} />
        </div>
      )
    case 'impact':
      return (
        <div className="dialog" role="dialog" aria-label="影響試算">
          <div className="body">
            <h3 style={{ margin: '0 0 8px' }}>{panel.title}</h3>
            <ul data-testid="impact">
              {panel.lines.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </div>
          <Foot items={[['Enter', '確定'], ['Escape', '取り消し']]} />
        </div>
      )
    case 'import':
      return (
        <div className="dialog wide" role="dialog" aria-label={panel.title}>
          <div className="body wizard">
            <h3 style={{ margin: '0 0 8px' }}>{panel.title}</h3>
            <AutoInput multiline value={panel.text} onChange={(v) => st.set({ panel: { ...panel, text: v } })} placeholder="Excel からコピーして貼り付け（タブ区切り）。Ctrl+Enter で取り込み" testid="import-text" />
          </div>
          <Foot items={[['Ctrl+Enter', '取り込む'], ['Escape', '閉じる']]} />
        </div>
      )
    case 'replyIssue':
      return (
        <div className="dialog" role="dialog" aria-label="指摘に返信">
          <div className="body">
            <h3 style={{ margin: '0 0 8px' }}>返信 {panel.issueId}</h3>
            <AutoInput value={panel.text} onChange={(v) => st.set({ panel: { ...panel, text: v } })} placeholder="返信（Enter で送信）" testid="reply-text" />
          </div>
          <Foot items={[['Enter', '送信'], ['Escape', '閉じる']]} />
        </div>
      )
    case 'inbox': {
      const q = panel.query.toLowerCase()
      const list = st.ws.projects.filter((x) => !q || (x.id + x.name).toLowerCase().includes(q))
      return (
        <div className="dialog wide" role="dialog" aria-label="受信箱">
          <AutoInput value={panel.query} onChange={(v) => st.set({ panel: { ...panel, query: v, index: 0 } })} placeholder="案件を検索（Enter で開く。自分宛の最初の行にジャンプ）" testid="inbox-input" />
          <div className="list" data-testid="inbox">
            {list.map((x, i) => {
              const bc = ballCounts(x)
              const mine = bc[st.ws.user.role]
              return (
                <div key={x.id} className="item" aria-selected={i === panel.index}>
                  <span className="sec mono">{x.id}</span>
                  <span>{x.name}</span>
                  <span className="desc">
                    納期 {x.dueDate ?? '未定'} / 提出 Rev.{x.submissions.at(-1)?.rev ?? 0} / 設計 {bc.design} 購買 {bc.purchasing} PM {bc.pm} / 更新 {fmtDateTime(x.updatedAt)} {x.events.at(-1)?.by.name ?? ''}
                  </span>
                  <span className="keys">{mine > 0 && <span className="chip err">あなた宛 {mine}</span>}</span>
                </div>
              )
            })}
            <div className="item" aria-selected={panel.index === list.length}>
              <span className="sec">＋</span>
              <span>新しいBOM を作る</span>
            </div>
          </div>
          <Foot items={[['Enter', '開く'], ['Escape', '閉じる']]} />
        </div>
      )
    }
    case 'settings': {
      const fields = settingsFields(p)
      return (
        <div className="dialog wide" role="dialog" aria-label="案件設定">
          <div className="body panel-list" data-testid="settings">
            <h3 style={{ margin: '0 0 8px' }}>
              案件設定 <span className="muted">（PM 項目は PM、購買項目は購買が変更。{p.settings.pmConfirmed ? '確定済' : '未確定（PM が y で確定）'}）</span>
            </h3>
            {fields.map((f, i) => (
              <div key={f.key} className="opt" aria-selected={i === panel.index}>
                <span className="muted" style={{ width: 60 }}>{f.owner}</span>
                <span style={{ width: 220 }}>{f.label}</span>
                {panel.editing && i === panel.index ? <input className="f" autoFocus data-testid="settings-input" value={panel.value} onChange={(e) => st.set({ panel: { ...panel, value: e.target.value } })} style={{ width: 240 }} /> : <span className="mono">{panel.draft[f.key] ?? f.value}</span>}
              </div>
            ))}
          </div>
          <Foot items={[['Enter', '編集 / 確定'], ['y', 'PM: 設定を確定'], ['Ctrl+Enter', '保存（理由を聞く）'], ['Escape', '閉じる']]} />
        </div>
      )
    }
    case 'weights': {
      const w = p.rowWeights[panel.rowId] ?? p.weights
      const keys = ['price', 'lead', 'record', 'terms'] as const
      return (
        <div className="dialog" role="dialog" aria-label="この行の重み">
          <div className="body panel-list">
            <h3 style={{ margin: '0 0 8px' }}>この行だけ重みを変える {panel.rowId}</h3>
            {keys.map((k, i) => (
              <div key={k} className="opt" aria-selected={i === panel.index}>
                <span style={{ width: 60 }}>{['価格', '納期', '実績', '条件'][i]}</span>
                <span className="scorebar" style={{ width: w[k] * 2 }} /> <span className="mono">{w[k]}</span>
              </div>
            ))}
          </div>
          <Foot items={[['ArrowLeft', '−5'], ['ArrowRight', '+5'], ['Delete', '案件既定に戻す'], ['Escape', '閉じる']]} />
        </div>
      )
    }
    case 'history': {
      const evs = [...p.events].reverse().slice(0, 50)
      return (
        <div className="dialog wide" role="dialog" aria-label="履歴">
          <div className="body">
            <h3 style={{ margin: '0 0 8px' }}>履歴（最新 50 件）</h3>
            <ul className="history">
              {evs.map((ev) => (
                <li key={ev.id}>
                  <span className="who">{ev.by.name}</span> {fmtDateTime(ev.at)} {ev.rowId ? <b>{ev.rowId}</b> : null} {ev.text}
                </li>
              ))}
            </ul>
          </div>
          <Foot items={[['Escape', '閉じる']]} />
        </div>
      )
    }
    case 'wizard':
      return <Wizard panel={panel} />
  }
}

export function settingsFields(p: ReturnType<typeof useStore.getState>['project'] extends () => infer R ? R : never) {
  const s = p.settings
  return [
    { key: 'name', label: '案件名', owner: 'PM', value: p.name },
    { key: 'dueDate', label: '案件納期', owner: 'PM', value: p.dueDate ?? '未定' },
    { key: 'processDays', label: '社内工程日数（この案件）', owner: 'PM', value: String(s.processDays) },
    { key: 'budget', label: '予算', owner: 'PM', value: s.budget == null ? '' : String(s.budget) },
    { key: 'weights', label: '重み（価格,納期,実績,条件）', owner: 'PM', value: `${p.weights.price},${p.weights.lead},${p.weights.record},${p.weights.terms}` },
    { key: 'selector', label: '選定者（design / purchasing）', owner: 'PM', value: s.selector },
    { key: 'changeNeedsPmApproval', label: '設計変更は PM 承認が必要', owner: 'PM', value: s.changeNeedsPmApproval ? 'はい' : 'いいえ' },
    { key: 'externalApprovalAmount', label: '上長決裁: 行の差額 ≥', owner: 'PM', value: String(s.externalApprovalAmount) },
    { key: 'externalApprovalBudgetPct', label: '上長決裁: 予算比 +%', owner: 'PM', value: String(s.externalApprovalBudgetPct * 100) },
    { key: 'members', label: '担当者（設計,購買,PM）', owner: 'PM', value: `${p.members.design},${p.members.purchasing},${p.members.pm}` },
    { key: 'quoteDays', label: '回答期限の既定（日）', owner: '購買', value: String(s.quoteDays) },
    { key: 'quoteDeadline', label: '今回の回答期限', owner: '購買', value: s.quoteDeadline ?? '' },
    { key: 'quoteCompleteRule', label: '見積完了条件（all / min2 / deadline）', owner: '購買', value: s.quoteCompleteRule },
    { key: 'tieThreshold', label: '拮抗閾値（点）', owner: '購買', value: String(s.tieThreshold) },
    { key: 'exceptionAmount', label: '例外閾値（円）', owner: '購買', value: String(s.exceptionAmount) },
    { key: 'exceptionPct', label: '例外閾値（%）', owner: '購買', value: String(s.exceptionPct * 100) },
    { key: 'formalDiffPct', label: '正式見積の差分閾値（%）', owner: '購買', value: String(s.formalDiffPct * 100) },
    { key: 'formalDiffAmount', label: '正式見積の差分閾値（円）', owner: '購買', value: String(s.formalDiffAmount) },
    { key: 'qtyTolerancePct', label: '数量変更の許容（%）', owner: '購買', value: String(s.qtyTolerancePct * 100) },
    { key: 'formalDays', label: '正式見積の所要日数', owner: '購買', value: String(s.formalDays) },
    { key: 'currency', label: '通貨', owner: '購買', value: s.currency },
    { key: 'holidays', label: '休日（カンマ区切り）', owner: '購買', value: s.holidays.join(',') },
    { key: 'supplierIds', label: '相見積先（商社ID カンマ区切り）', owner: '購買', value: p.supplierIds.join(',') },
  ]
}

const WIZ_STEPS = ['案件ID', '案件名', '納期', '社内工程日数', '予算（任意）', '購買担当者', '希望商社', '部品の入れ方', 'チェック']

function Wizard({ panel }: { panel: Extract<Panel, { kind: 'wizard' }> }) {
  const st = useStore()
  const d = panel.data
  const step = panel.step
  const setData = (k: string, v: string) => st.set({ panel: { ...panel, data: { ...d, [k]: v } } })
  const key = ['id', 'name', 'due', 'processDays', 'budget', 'buyer', 'suppliers', 'input', 'check'][step]
  return (
    <div className="dialog wide wizard" role="dialog" aria-label="新しいBOM">
      <div className="steps">
        {WIZ_STEPS.map((s, i) => (
          <span key={s} className={i === step ? 'on' : i < step ? 'done' : ''}>
            {i + 1}.{s}
          </span>
        ))}
      </div>
      <div className="body" data-testid="wizard">
        <h3 style={{ margin: '0 0 4px' }}>{WIZ_STEPS[step]}</h3>
        {step <= 5 && (
          <>
            <div className="muted" style={{ marginBottom: 6 }}>{['例: P-2026-042', '例: 第4ライン 制御盤', 'YYYY-MM-DD または 未定', '納期から逆算して必要日を出す日数（既定 10）', '目標原価（円）。空でも可', '購買担当者の氏名'][step]}</div>
            <AutoInput value={d[key] ?? ''} onChange={(v) => setData(key, v)} placeholder="" testid={`wizard-${key}`} />
            <div className="muted" style={{ marginTop: 6 }}>納期・工程日数・予算は「仮（PM 未確定）」で保存され、提出 Rev.1 で PM の要決定に載ります。</div>
          </>
        )}
        {step === 6 && (
          <div className="panel-list">
            {st.ws.suppliers.map((s, i) => (
              <div key={s.id} className="opt" aria-selected={i === panel.sel}>
                <span className="check">{panel.picks.includes(s.id) ? '●' : '○'}</span>
                <span className="supplier-dot" style={{ background: s.color }} />
                <span>{s.name}</span>
                <span className="muted">{s.kind} / {s.tradable ? '取引可' : '取引停止'} / {s.handledMakers.length ? s.handledMakers.slice(0, 3).join('・') : '取扱メーカ未登録'}</span>
              </div>
            ))}
            <div className="muted">希望商社（任意）。確定は購買が行います。Space で選択、Enter で次へ</div>
          </div>
        )}
        {step === 7 && (
          <>
            <div className="panel-list">
              {['1 貼り付け（Excel の表をコピーして貼る）', '2 ファイル（次の画面で貼り付けと同じ形式を使う）', '3 1つずつ入力（空の表から始める）'].map((o, i) => (
                <div key={o} className="opt" aria-selected={panel.sel === i}>
                  <span>{o}</span>
                </div>
              ))}
            </div>
            {panel.sel !== 2 && <AutoInput multiline value={d.paste ?? ''} onChange={(v) => setData('paste', v)} placeholder={'分類\t部品名\t型式\tメーカ\t数量\t単位\t回路記号（タブ区切り、ヘッダー行は任意）'} testid="wizard-paste" />}
          </>
        )}
        {step === 8 && <div className="muted">Enter で作成します。作成後は「4 要確認」で問題を 1 件ずつ直し（Enter で直して次へ、x で確認済み、Shift+→ であとで）、Ctrl+Enter で提出します。</div>}
      </div>
      <Foot items={[['Enter', '次へ'], ['Alt+ArrowLeft', '1つ前の段階'], ['Escape', '中止']]} />
    </div>
  )
}
