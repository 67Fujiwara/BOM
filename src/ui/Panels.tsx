import { useEffect, useRef, type ReactNode } from 'react'
import { useStore, type Panel } from '@/model/store'
import { KEYMAP, formatKey } from '@/keys/keymap'
import { onCommandCell } from '@/commands/keyboard'

/** 英字・数字 1 キーの操作は、いまのセルで素のキーが値になるなら Alt 付きで見せる（§14.1） */
function navKey(k: string): string {
  if (!/^(Shift\+)?[A-Za-z0-9]$/.test(k) && !/^[^A-Za-z0-9 ]$/.test(k)) return k
  return onCommandCell(k.slice(-1)) ? k : `Alt+${k}`
}
import { COLUMNS } from '@/model/columns'
import { ROLE_LABEL, ISSUE_KINDS } from '@/model/types'
import { colsForPanel, paletteItems, WIZ_KEYS } from '@/commands/registry'
import { issueKindsFor } from '@/commands/keyboard'
import { ballCounts, effective, fmtYen } from '@/model/derive'
import { scoreRow } from '@/model/score'
import { fmtDateTime } from '@/model/dates'
import { settingsFields } from './settingsFields'
import { FIELD_LABEL, parseBomPaste, xlsxToTsv } from '@/io/paste'
import * as pasteIo from '@/io/paste'

/** パネルのキー操作を合成する（クリックでもキーと同じ動きにするため） */
function press(key: string) {
  const init: KeyboardEventInit = { key, bubbles: true, cancelable: true }
  if (key === 'Ctrl+Enter') Object.assign(init, { key: 'Enter', ctrlKey: true })
  window.dispatchEvent(new KeyboardEvent('keydown', init))
}

export function Panels() {
  const st = useStore()
  const panel = st.panel
  if (!panel) return null
  return (
    <div className="overlay" data-testid={`panel-${panel.kind}`} onMouseDown={(e) => e.target === e.currentTarget && press('Escape')}>
      <PanelBody panel={panel} />
    </div>
  )
}

function Foot({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="foot">
      {items.map(([k, l]) => (
        <span key={k + l}>
          <kbd>{formatKey(k)}</kbd> {l}
        </span>
      ))}
    </div>
  )
}

function AutoInput({ value, onChange, placeholder, testid, multiline, autoFocus = true, className, onPointer }: { value: string; onChange: (v: string) => void; placeholder?: string; testid?: string; multiline?: boolean; autoFocus?: boolean; className?: string; onPointer?: () => void }) {
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])
  if (multiline) return <textarea ref={ref} className={className ?? 'f'} rows={8} data-testid={testid} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
  return <input ref={ref} className={className ?? 'q'} data-testid={testid} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} onMouseDown={onPointer} />
}

/** 選ばれている項目が見えるようにスクロールする */
function useScrollSelected(dep: unknown) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [dep])
  return ref
}

function OptionList({ options, index, onPick, testid, render }: { options: Array<{ label: string; key?: string }>; index: number; onPick: (i: number) => void; testid?: string; render?: (o: { label: string; key?: string }, i: number) => ReactNode }) {
  const ref = useScrollSelected(index)
  return (
    <div className="body panel-list" data-testid={testid} ref={ref}>
      {options.map((o, i) => (
        <div key={o.label + i} className="opt clickable" aria-selected={i === index} onClick={() => onPick(i)}>
          {render ? render(o, i) : (
            <>
              <kbd>{o.key ? formatKey(o.key) : i < 9 ? i + 1 : '·'}</kbd> <span>{o.label}</span>
            </>
          )}
        </div>
      ))}
      {options.length === 0 && <div className="muted">候補がありません（Enter / Esc で閉じる）</div>}
    </div>
  )
}

function PanelBody({ panel }: { panel: Panel }) {
  const st = useStore()
  const p = st.project()
  const setIndex = (i: number) => st.set({ panel: { ...panel, index: i } as Panel })
  const listRef = useScrollSelected('index' in panel ? panel.index : 0)
  switch (panel.kind) {
    case 'palette': {
      const items = paletteItems(panel.query)
      return (
        <div className="dialog" role="dialog" aria-label="コマンドパレット">
          <AutoInput value={panel.query} onChange={(v) => st.set({ panel: { ...panel, query: v, index: 0 } })} placeholder="やりたいことを入力（例: 公開、エクセル、R034 採用、ヘルプ）" testid="palette-input" />
          <div className="list" data-testid="palette-list" ref={listRef}>
            {items.slice(0, 60).map((it, i) => (
              <div key={it.id + i} className="item" aria-selected={i === panel.index} onMouseEnter={() => setIndex(i)} onClick={() => it.run()}>
                <span className="sec">{it.section}</span>
                <span>{it.label}</span>
                {it.desc && <span className="desc">{it.desc}</span>}
                <span className="keys">
                  {it.keys?.map((k) => (
                    <kbd key={k}>{formatKey(navKey(k))}</kbd>
                  ))}
                </span>
              </div>
            ))}
            {items.length === 0 && <div className="item muted">該当する操作がありません。F1 でショートカット一覧、「ヘルプ」と打つと使い方</div>}
          </div>
          <Foot items={[['Enter', '実行'], ['ArrowUp', '/ ↓ 選択'], ['Escape', '閉じる']]} />
        </div>
      )
    }
    case 'help': {
      const sections = [...new Set(KEYMAP.map((b) => b.section))]
      return (
        <div className="dialog wide" role="dialog" aria-label="ショートカット一覧">
          <div className="body">
            <h3 style={{ margin: '0 0 4px' }}>ショートカット一覧</h3>
            <p className="muted" style={{ margin: '0 0 10px', fontSize: 12 }}>
              迷ったら <kbd>Ctrl+K</kbd> で操作を名前で探せます。1 キーの操作は表の上（ナビモード）でだけ効き、セルの編集中は効きません。すべての操作は <kbd>Ctrl+Z</kbd> で戻せます（あなた自身の操作だけ）。
              <br />
              表の中の英字・数字は、ID・状態の列ではそのまま 1 キー操作、文字を打てるセルでは値の入力です（Excel と同じ）。自分が書けない列・発注と入荷の列で打った英字・数字は、操作の名前と Alt の形を知らせるだけです（発注・入荷は Enter で切り替え）。PM は数字でビューを切り替え、7 では y / Shift+Y がどの列でも効きます。打って始めた入力は矢印で確定して隣のセルへ、Enter で始めた編集では矢印は文字の中を動きます。下の一覧のキーは、いまのセルで押せる形（必要なら Alt 付き）で出しています。どの列でも <kbd>Alt</kbd> を押しながらなら 1 キー操作です（例: <kbd>Alt+x</kbd> 確認済み、<kbd>Alt+a</kbd> 推奨で採用、<kbd>Alt+Shift+I</kbd> 指摘、<kbd>Alt+4</kbd> 要確認）。次の問題は <kbd>F8</kbd>、最安で採用は <kbd>Ctrl+Alt+A</kbd>。
            </p>
            <div className="help-cols" data-testid="help">
              {sections.map((sec) => (
                <section key={sec}>
                  <h4>{sec}</h4>
                  {KEYMAP.filter((b) => b.section === sec).map((b) => (
                    <div className="r" key={b.id}>
                      <span>{b.label}</span>
                      <span className="ks">
                        {b.keys.map((k) => (
                          <kbd key={k}>{formatKey(b.mode === 'nav' ? navKey(k) : k)}</kbd>
                        ))}
                      </span>
                    </div>
                  ))}
                </section>
              ))}
              <section>
                <h4>要決定（7 ビュー・PM）</h4>
                {[
                  ['y', '承認 / 受入 / 許可'],
                  ['Shift+Y', '却下 / 受入（遅延許容）/ 現状維持'],
                  ['Enter', '決定パネル（b 次点 / g 再交渉 / d 設計へ代替依頼 / q 数量見直し / e 特急・分納 / p 委譲）'],
                ].map(([k, l]) => (
                  <div className="r" key={k}>
                    <span>{l}</span>
                    <span className="ks">
                      <kbd>{formatKey(navKey(k))}</kbd>
                    </span>
                  </div>
                ))}
              </section>
              <section>
                <h4>行の詳細（Space で開いて ↓ で選択）</h4>
                {[
                  ['Enter', '指摘のアクション（返信 / 直さず回答 / 客先承認取得 / 提案を適用 / ルール化 / 見送り / 代替なし）、見積のアクション（採用 / 据え置き / 再見積）'],
                  ['Shift+R', '返信'],
                ].map(([k, l]) => (
                  <div className="r" key={k}>
                    <span>{l}</span>
                    <span className="ks">
                      <kbd>{formatKey(k)}</kbd>
                    </span>
                  </div>
                ))}
              </section>
              <section>
                <h4>新規BOMガイド</h4>
                {[
                  ['Enter', '次へ（貼り付け欄の中は Ctrl+Enter）'],
                  ['Alt+ArrowLeft', '1 つ前の段階'],
                  ['Escape', '中止（入れた内容は残る）'],
                ].map(([k, l]) => (
                  <div className="r" key={k + l}>
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
      const cols = colsForPanel()
      return (
        <div className="dialog" role="dialog" aria-label="列の表示">
          <div className="body panel-list" data-testid="columns" ref={listRef}>
            <h3 style={{ margin: '0 0 8px' }}>列の表示（すべて・購買提出用以外のビューは列が決まっています）</h3>
            {cols.map((key, i) => {
              const c = COLUMNS.find((x) => x.key === key)!
              return (
                <div key={c.key} className="opt clickable" aria-selected={i === panel.index} onClick={() => (setIndex(i), press(' '))}>
                  <span className="check">{st.hiddenCols.includes(c.key) ? '○' : '●'}</span>
                  <span>{c.label}</span>
                  <span className="muted" style={{ marginLeft: 'auto' }}>
                    {c.editableBy.map((r) => ROLE_LABEL[r]).join('・') || '自動'}
                  </span>
                </div>
              )
            })}
          </div>
          <Foot items={[['ArrowUp', '/ ↓ 選択'], [' ', '表示を切り替え'], ['Escape', '閉じる']]} />
        </div>
      )
    }
    case 'issue': {
      const row = p.rows.find((r) => r.id === panel.rowId)
      const kinds = issueKindsFor()
      const defs = ISSUE_KINDS.filter((k) => kinds.includes(k.kind))
      const proposalKind = panel.issueKind === '廃番' || panel.issueKind === '代替提案'
      return (
        <div className="dialog" role="dialog" aria-label="指摘を起票">
          <div className="body">
            <h3 style={{ margin: '0 0 8px' }}>
              指摘を起票 <span className="muted">{panel.rowId} {row ? effective(row).name : ''}</span>
            </h3>
            {panel.step === 'kind' && (
              <div className="panel-list" data-testid="issue-kinds" ref={listRef}>
                {defs.map((k, i) => (
                  <div key={k.kind} className="opt clickable" aria-selected={i === panel.index} onClick={() => (setIndex(i), press('Enter'))}>
                    <kbd>{k.key}</kbd> <span>{k.kind}</span>
                    <span className="muted" style={{ marginLeft: 'auto' }}>
                      対応 {ROLE_LABEL[k.resolver]} / 期限 {k.dueDays} 営業日
                    </span>
                  </div>
                ))}
                {st.ws.user.role !== 'purchasing' && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{ROLE_LABEL[st.ws.user.role]}が起票できるのは「質問」「その他」です（型式あいまい等の指摘は購買が起票します）</div>}
              </div>
            )}
            {panel.step === 'text' && (
              <>
                <div className="muted" style={{ marginBottom: 6 }}>種別: {panel.issueKind}{panel.issueKind === '最小ロット' ? '（空なら「必要数 → 丸め数量（余剰）」を自動で書きます）' : ''}</div>
                <AutoInput value={panel.text} onChange={(v) => st.set({ panel: { ...panel, text: v } })} placeholder={`本文（何がどう問題か）。Enter で起票${proposalKind ? '、Tab で提案欄（型式・メーカ・商社・単価・納期）' : ''}`} testid="issue-text" />
              </>
            )}
            {panel.step === 'proposal' && (
              <div className="wizard">
                <div className="muted">提案（型式 / メーカ / 商社 / 単価 / 納期）。Tab で次の欄、Enter で起票</div>
                {(['model', 'maker', 'supplierId', 'unitPrice', 'leadDays'] as const).map((k, i) => (
                  <label key={k}>
                    {['提案型式', '提案メーカ', `商社（${st.ws.suppliers.map((s) => s.id + ' ' + s.name).join(' / ')}）`, '単価', '納期（日）'][i]}
                    <input className="f" data-testid={`proposal-${k}`} value={panel.proposal[k]} onChange={(e) => st.set({ panel: { ...panel, proposal: { ...panel.proposal, [k]: e.target.value } } })} autoFocus={i === 0} />
                  </label>
                ))}
              </div>
            )}
          </div>
          <Foot items={panel.step === 'kind' ? [['k', '等の頭文字 / ↑↓ Enter で種別'], ['Escape', '閉じる']] : [['Enter', '起票（下書き）'], ['Ctrl+Enter', '起票して次の行へ'], ...(proposalKind && panel.step === 'text' ? ([['Tab', '提案欄']] as Array<[string, string]>) : []), ['Escape', '閉じる']]} />
        </div>
      )
    }
    case 'adopt': {
      const row = p.rows.find((r) => r.id === panel.rowId)!
      const scores = scoreRow(p, row, st.ws.suppliers)
      return (
        <div className="dialog" role="dialog" aria-label="商社を選んで採用">
          <div className="body panel-list" data-testid="adopt" ref={listRef}>
            <h3 style={{ margin: '0 0 8px' }}>
              商社を選んで採用 <span className="muted">{row.id} {effective(row).name}</span>
            </h3>
            {scores.map((sc, i) => (
              <div key={sc.supplierId} className="opt clickable" aria-selected={i === panel.index} onClick={() => (setIndex(i), press(String(i + 1)))}>
                <kbd>{i + 1}</kbd>
                <span className="supplier-dot" style={{ background: st.ws.suppliers.find((s) => s.id === sc.supplierId)?.color }} />
                <span>{st.ws.suppliers.find((s) => s.id === sc.supplierId)?.name}</span>
                <span className="muted">
                  {fmtYen(sc.quote.unitPrice, p.settings.currency)} / {sc.quote.stock === '在庫' ? '即納' : `${sc.quote.leadDays}日`} / スコア {sc.total} {sc.reasons.join('・')}
                  {i === 0 ? '（推奨）' : ''}
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
        <div className={'dialog' + (panel.danger ? ' danger' : '')} role="dialog" aria-label={panel.title}>
          <div className="body">
            <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>{panel.title}</h3>
            {panel.options && (
              <div className="panel-list" data-testid="prompt-options" ref={listRef}>
                {panel.options.map((o, i) => (
                  <div key={o} className="opt clickable" aria-selected={i === panel.index} onClick={() => {
                    setIndex(i)
                    if (!panel.showText) return press('Enter')
                    // 文字の欄もあるダイアログでは、選択肢をクリックしたら文字の欄へ（続けて打った番号・理由が欄に入る）
                    st.set({ panel: { ...(useStore.getState().panel as typeof panel), index: i, textTouched: true } })
                    document.querySelector<HTMLElement>('[data-testid="prompt-text"]')?.focus()
                  }}>
                    <kbd>{panel.showText && !panel.digitsSelect ? (i === panel.index ? '▶' : '·') : i + 1}</kbd> <span>{o}</span>
                  </div>
                ))}
              </div>
            )}
            {panel.showText && <AutoInput value={panel.text} onChange={(v) => st.set({ panel: { ...(useStore.getState().panel as typeof panel), text: v, textTouched: true } })} onPointer={() => st.set({ panel: { ...(useStore.getState().panel as typeof panel), textTouched: true } })} placeholder={panel.placeholder ?? (panel.requireText ? '理由・本文（必須。Enter で確定）' : '補足（任意。Enter で確定）')} testid="prompt-text" />}
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
          <Foot items={panel.showText && panel.options ? [...(panel.digitsSelect && !panel.textTouched ? ([['1', '〜 数字で選ぶ'], ['Tab', '文字の欄へ（数字で始まるとき）']] as Array<[string, string]>) : []), ['ArrowUp', '/ ↓ 選択'], ...(panel.digitsSelect && panel.textTouched ? ([['Shift+Tab', '数字で選ぶに戻る']] as Array<[string, string]>) : []), ['Enter', '確定'], ['Escape', '取り消し']] : panel.options ? [['1', '〜 数字で選ぶ'], ['Enter', '選択中を確定'], ['Escape', '取り消し']] : [['Enter', '確定'], ['Escape', '取り消し']]} />
        </div>
      )
    case 'quickfix':
    case 'rule':
    case 'export': {
      const title = panel.kind === 'export' ? 'Excel 出力（どこに出すもの？）' : panel.kind === 'rule' ? 'ルールを追加' : panel.title
      return (
        <div className="dialog" role="dialog" aria-label={title}>
          <h3 style={{ margin: '14px 18px 0', fontSize: 14 }}>{title}</h3>
          <div ref={listRef}>
            <OptionList testid="quickfix" options={panel.options} index={panel.index} onPick={(i) => (setIndex(i), press('Enter'))} />
          </div>
          <Foot items={[['Enter', '実行'], ['ArrowUp', '/ ↓ 選択'], ['Escape', '閉じる']]} />
        </div>
      )
    }
    case 'consolidate':
      return (
        <div className="dialog wide" role="dialog" aria-label="商社を集約">
          <div className="body panel-list" ref={listRef}>
            <h3 style={{ margin: '0 0 8px' }}>商社を集約（試算。Enter で適用）</h3>
            {panel.options.map((o, i) => (
              <div key={o.label} className="opt clickable" aria-selected={i === panel.index} onClick={() => (setIndex(i), press('Enter'))}>
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
          <Foot items={[['Enter', '確定に進む'], ['Escape', '取り消し']]} />
        </div>
      )
    case 'import':
      return (
        <div className="dialog wide" role="dialog" aria-label={panel.title}>
          <div className="body wizard">
            <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>{panel.title}</h3>
            {panel.accept && (
              <label className="btn" style={{ display: 'inline-block', marginBottom: 8, cursor: 'pointer' }}>
                ファイルを選ぶ
                <input
                  type="file"
                  accept={panel.accept}
                  data-testid="import-file"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    const text = await f.text()
                    const cur = useStore.getState().panel
                    if (cur?.kind === 'import') useStore.getState().set({ panel: { ...cur, text } })
                    useStore.getState().toastMsg(`${f.name} を読み込みました（Ctrl+Enter で反映）`, 'info')
                  }}
                />
              </label>
            )}
            <AutoInput multiline value={panel.text} onChange={(v) => st.set({ panel: { ...panel, text: v } })} placeholder={panel.placeholder ?? 'Excel からコピーして貼り付け（Ctrl+V）。Ctrl+Enter で取り込み'} testid="import-text" />
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
          <AutoInput value={panel.query} onChange={(v) => st.set({ panel: { ...panel, query: v, index: 0 } })} placeholder="案件を検索（Enter で開いて、あなた宛の最初の行へ）" testid="inbox-input" />
          <div className="list" data-testid="inbox" ref={listRef}>
            {list.map((x, i) => {
              const bc = ballCounts(x)
              const mine = bc[st.ws.user.role]
              return (
                <div key={x.id} className="item" aria-selected={i === panel.index} onClick={() => (setIndex(i), press('Enter'))}>
                  <span className="sec mono">{x.id}</span>
                  <span>{x.name}</span>
                  <span className="desc">
                    納期 {x.dueDate ?? '未定'} / 提出 Rev.{x.submissions.at(-1)?.rev ?? 0} / 設計 {bc.design} 購買 {bc.purchasing} PM {bc.pm} / 更新 {fmtDateTime(x.updatedAt)} {x.events.at(-1)?.by.name ?? ''}
                  </span>
                  <span className="keys">{mine > 0 && <span className="chip err">あなた宛 {mine}</span>}</span>
                </div>
              )
            })}
            {q && !list.length && <div className="item muted">「{panel.query}」に当たる案件はありません</div>}
            <div className="item" aria-selected={panel.index === list.length} onClick={() => (setIndex(list.length), press('Enter'))}>
              <span className="sec">＋</span>
              <span>新しいBOM を作る</span>
            </div>
          </div>
          <Foot items={[['Enter', '開く'], ['ArrowUp', '/ ↓ 選択'], ['Escape', '閉じる']]} />
        </div>
      )
    }
    case 'settings': {
      const fields = settingsFields(p)
      return (
        <div className="dialog wide" role="dialog" aria-label="案件設定">
          <div className="body panel-list" data-testid="settings" ref={listRef}>
            <h3 style={{ margin: '0 0 8px' }}>
              案件設定 <span className="muted">（PM 項目は PM、購買項目は購買が変更。{p.settings.pmConfirmed ? '確定済' : '未確定（PM が y で確定）'}）</span>
            </h3>
            {fields.map((f, i) => {
              const role = st.ws.user.role
              const mine = (f.owner === 'PM' && role === 'pm') || (f.owner === '購買' && role !== 'design')
              return (
                <div key={f.key} className={'opt clickable' + (mine ? '' : ' disabled')} aria-selected={i === panel.index} onClick={() => !panel.editing && (setIndex(i), press('Enter'))}>
                  <span className="muted" style={{ width: 40 }}>{f.owner}</span>
                  <span style={{ width: 240 }}>{f.label}</span>
                  {panel.editing && i === panel.index ? (
                    <span style={{ flex: 1 }}>
                      <input className="f" autoFocus data-testid="settings-input" value={panel.value} onChange={(e) => st.set({ panel: { ...panel, value: e.target.value, error: undefined } })} style={{ width: '100%' }} placeholder={f.hint} />
                      {panel.error && <span className="err-text" style={{ display: 'block' }}>{panel.error}</span>}
                    </span>
                  ) : (
                    <span className="mono">
                      {panel.draft[f.key] ?? f.value}
                      {f.key in panel.draft && <span className="chip warn" style={{ marginLeft: 6 }}>変更</span>}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          <Foot items={[['Enter', '項目を編集 / 確定'], ['Ctrl+Enter', '保存（理由を聞く）'], ['y', 'PM: 設定を確定'], ['Escape', '閉じる']]} />
        </div>
      )
    }
    case 'weights': {
      const w = p.rowWeights[panel.rowId] ?? p.weights
      const keys = ['price', 'lead', 'record', 'terms'] as const
      return (
        <div className="dialog" role="dialog" aria-label="この行の重み">
          <div className="body panel-list">
            <h3 style={{ margin: '0 0 8px' }}>
              この行だけ重みを変える {panel.rowId} {p.rowWeights[panel.rowId] ? '' : <span className="muted">（いまは案件の既定）</span>}
            </h3>
            {keys.map((k, i) => (
              <div key={k} className="opt" aria-selected={i === panel.index}>
                <span style={{ width: 60 }}>{['価格', '納期', '実績', '条件'][i]}</span>
                <span className="scorebar" style={{ width: w[k] * 2 }} /> <span className="mono">{w[k]}</span>
              </div>
            ))}
          </div>
          <Foot items={[['ArrowLeft', '−5'], ['ArrowRight', '+5'], ['Delete', '案件の既定に戻す'], ['Escape', '閉じる']]} />
        </div>
      )
    }
    case 'history': {
      const evs = [...p.events].reverse().slice(0, 80)
      return (
        <div className="dialog wide" role="dialog" aria-label="履歴">
          <div className="body">
            <h3 style={{ margin: '0 0 8px' }}>履歴（最新 80 件）</h3>
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

const WIZ_STEPS = ['案件ID', '案件名', '納期', '社内工程日数', '予算（任意）', '購買・PM 担当者', '希望商社', '部品の入れ方', '確認して作成']

function Wizard({ panel }: { panel: Extract<Panel, { kind: 'wizard' }> }) {
  const st = useStore()
  const d = panel.data
  const step = panel.step
  const setData = (k: string, v: string) => st.set({ panel: { ...panel, data: { ...d, [k]: v }, error: undefined } })
  const key = WIZ_KEYS[step]
  const fileRef = useRef<HTMLInputElement>(null)
  const preview = step === 8 && d.inputMode !== '2' ? parseBomPaste(d.paste ?? '') : null
  const onFile = async (f: File | undefined) => {
    if (!f) return
    try {
      // 中身で判別する（拡張子が無い・違うファイルでも、Excel は zip の先頭 PK で分かる）
      const buf = await f.arrayBuffer()
      const head = new Uint8Array(buf.slice(0, 4))
      const isZip = head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04
      if (/\.xlsx$/i.test(f.name) && !isZip) throw new Error('Excel（.xlsx）として読めません。壊れているか、別の形式のファイルです')
      let text: string
      if (isZip) {
        try {
          text = await xlsxToTsv(buf)
        } catch {
          throw new Error('Excel（.xlsx）として読めません。壊れているか、パスワード付きのファイルです')
        }
      } else {
        // 日本語の Excel が出す CSV は Shift_JIS のことが多い。UTF-8 で読めなければ Shift_JIS で読む
        // Excel の「Unicode テキスト」は UTF-16（先頭が FF FE / FE FF）
        const bom = new Uint8Array(buf.slice(0, 2))
        const utf16 = bom[0] === 0xff && bom[1] === 0xfe ? 'utf-16le' : bom[0] === 0xfe && bom[1] === 0xff ? 'utf-16be' : null
        if (utf16) text = new TextDecoder(utf16).decode(buf)
        else
          try {
            text = new TextDecoder('utf-8', { fatal: true }).decode(buf)
          } catch {
            text = new TextDecoder('shift_jis').decode(buf)
          }
        if (/[\u0000\ufffd]/.test(text.slice(0, 4000))) throw new Error('文字のファイル（CSV・タブ区切り）ではありません。Excel から .xlsx か CSV で保存してください')
      }
      if (!text.trim()) throw new Error('中身が空です')
      const cur = useStore.getState().panel
      if (cur?.kind !== 'wizard') return
      st.set({ panel: { ...cur, data: { ...cur.data, paste: text, fileName: f.name, fileNote: isZip ? pasteIo.hiddenNote : '', inputMode: '1' }, error: undefined } })
      const others = isZip ? pasteIo.otherSheets : []
      st.toastMsg(`${f.name}${isZip && pasteIo.lastSheetName ? `（シート「${pasteIo.lastSheetName}」）` : ''} を読み込みました。Enter で次へ${isZip && pasteIo.hiddenNote ? `。${pasteIo.hiddenNote}` : ''}${others.length ? `。部品表らしいシートがほかにもあります（${others.map((n) => `「${n}」`).join('・')}）。そちらを読むときは Excel でそのシートだけを別のファイルに保存して読んでください` : ''}`, others.length || (isZip && pasteIo.hiddenNote) ? 'info' : 'ok')
    } catch (err) {
      st.toastMsg(`${f.name} を読めませんでした: ${(err as Error).message}`, 'err')
    }
  }
  const hints = ['例: P-2026-042（空なら自動で付けます）', '例: 第4ライン 制御盤', '2026-11-30 / 11/30 / 未定', '納期から逆算して必要日を出す日数（空なら 10）', '目標原価（円）。例: 2800000 / 280万。空でも可', '購買担当, PM 担当（カンマ区切り。例: 佐藤, 鈴木。空なら未定）']
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
            <div className="muted" style={{ marginBottom: 6 }}>{hints[step]}</div>
            <AutoInput key={step} className="f" value={d[key] ?? ''} onChange={(v) => setData(key, v)} placeholder="" testid={`wizard-${key}`} />
            {step >= 2 && step <= 4 && <div className="muted" style={{ marginTop: 6 }}>納期・工程日数・予算は「仮（PM 未確定）」で保存され、提出 Rev.1 で PM の要決定に載ります。</div>}
          </>
        )}
        {step === 6 && (
          <div className="panel-list">
            {st.ws.suppliers.map((s, i) => (
              <div key={s.id} className="opt clickable" aria-selected={i === panel.sel} onClick={() => st.set({ panel: { ...panel, sel: i, picks: panel.picks.includes(s.id) ? panel.picks.filter((x) => x !== s.id) : [...panel.picks, s.id] } })}>
                <span className="check">{panel.picks.includes(s.id) ? '●' : '○'}</span>
                <span className="supplier-dot" style={{ background: s.color }} />
                <span>{s.name}</span>
                <span className="muted">
                  {s.kind} / {s.tradable ? '取引可' : '取引停止'} / {s.handledMakers.length ? s.handledMakers.slice(0, 3).join('・') : '取扱メーカ未登録'}
                </span>
              </div>
            ))}
            <div className="muted">希望商社（任意。確定は購買）。↑↓ で移動、Space で選択、Enter で次へ</div>
          </div>
        )}
        {step === 7 && (
          <>
            <div className="panel-list">
              {['1 貼り付け（Excel の表をコピーして貼る。見出し行があれば列を自動で判別）', '2 ファイル（.xlsx / .csv / .tsv / .txt）', '3 1 つずつ入力（空の表から始める）'].map((o, i) => (
                <div key={o} className="opt clickable" aria-selected={panel.sel === i} onClick={() => st.set({ panel: { ...panel, sel: i, data: { ...d, inputMode: String(i) } } })}>
                  <span>{o}</span>
                </div>
              ))}
            </div>
            {panel.sel === 0 && <AutoInput multiline autoFocus={false} value={d.paste ?? ''} onChange={(v) => setData('paste', v)} placeholder={'例）見出し行つきでそのまま貼れます\n品名\t形式\tメーカー\t員数\nリレー\tMY4N-D2 DC24\tオムロン\t12\n\n貼り付け欄の中では Ctrl+Enter で次へ'} testid="wizard-paste" />}
            {panel.sel === 1 && (
              <div style={{ marginTop: 8 }}>
                <input ref={fileRef} type="file" data-testid="wizard-file" accept=".xlsx,.csv,.tsv,.txt" onChange={(e) => void onFile(e.target.files?.[0])} />
                {d.fileName && <div className="muted">読み込み済み: {d.fileName}（{(d.paste ?? '').split('\n').filter(Boolean).length} 行）</div>}
              </div>
            )}
            <div className="muted" style={{ marginTop: 6 }}>1〜3 で選ぶ（貼り付け欄の中では Ctrl+Enter で次へ。Enter は改行）。Enter で次へ</div>
          </>
        )}
        {step === 8 && (
          <div data-testid="wizard-preview">
            <div>
              案件 <b>{d.id || '（自動）'}</b> {d.name || '新しいBOM'} / 納期 {d.due || '未定'} / 工程日数 {d.processDays || 10} / 予算 {d.budget || 'なし'} / 購買・PM {d.buyer || '未定'} / 希望商社 {panel.picks.length} 社
            </div>
            {preview && (
              <>
                <div style={{ marginTop: 8 }}>
                  取り込む行: <b>{preview.rows.length}</b> 行（{preview.delimiter === 'tab' ? 'タブ区切り' : preview.delimiter === 'comma' ? 'カンマ区切り' : '1 列'}、見出し{preview.header ? 'あり' : 'なし'}）
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  列の対応: {preview.mapping.map((f, i) => `${preview.header ? preview.header[i] : `${i + 1}列目`} → ${f ? FIELD_LABEL[f] : '（使わない）'}`).join(' / ')}
                </div>
                {[...(d.fileName && d.fileNote ? [d.fileNote] : []), ...preview.warnings].map((w) => (
                  <div key={w} className="warn-text" style={{ fontSize: 12 }}>
                    ⚠ {w}
                  </div>
                ))}
                <table className="quotes" style={{ marginTop: 6 }}>
                  <tbody>
                    {preview.rows.slice(0, 5).map((r, i) => (
                      <tr key={i}>
                        <td>{r.category}</td>
                        <td>{r.name}</td>
                        <td className="mono">{r.model}</td>
                        <td>{r.maker}</td>
                        <td className="num">{r.qtyNeeded}</td>
                        <td>{r.unit}</td>
                        <td>{r.ref}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.rows.length > 5 && <div className="muted">… ほか {preview.rows.length - 5} 行</div>}
              </>
            )}
            {!preview && <div className="muted">空の表から始めます。</div>}
            <div className="muted" style={{ marginTop: 8 }}>Enter で作成します。作成後は「4 要確認」で問題を F8 で順に直し、Ctrl+Enter で提出します。</div>
          </div>
        )}
        {panel.error && (
          <div className="err-text" data-testid="wizard-error" style={{ marginTop: 8 }}>
            {panel.error}
          </div>
        )}
      </div>
      <Foot items={[step === 7 && (d.inputMode ?? '0') === '0' ? ['Ctrl+Enter', '次へ（貼り付け欄の Enter は改行）'] : ['Enter', step === 8 ? '作成' : '次へ'], ['Alt+ArrowLeft', '1 つ前'], ['Escape', '中止（内容は残る）']]} />
    </div>
  )
}
