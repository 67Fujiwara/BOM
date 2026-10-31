import { useMemo, useState } from 'react'
import { useStore, type Screen } from '@/model/store'
import type { Project, StockItem } from '@/model/types'
import { ROLE_LABEL, ROLES } from '@/model/types'
import { ballCounts } from '@/model/derive'
import { addSampleTo } from '@/model/sample'
import { isActive } from '@/model/derive'
import * as stock from '@/actions/stock'
import type { PurchaseEntry } from '@/actions/stock'
import { switchRole } from '@/commands/registry'
import { readPanelStudioFile, type PanelStudioBom } from '@/io/panelStudio'

const st = () => useStore.getState()

/** 一覧の画面へ移る（編集中の値は残さない） */
export function goScreen(screen: Screen) {
  useStore.setState({ screen, panel: null, mode: 'nav' })
}

/** 案件を開いて部品表の画面へ */
/** 案件を開く。view は 1 在庫 / 2 設計中 / 3 見積もり（既定は設計中） */
export function openProject(id: string, view: 1 | 2 | 3 = 2) {
  st().commitWs('', (ws) => {
    ws.currentProjectId = id
  })
  useStore.setState({ screen: 'project', view, detailIndex: 0, revView: null, sort: null, cursorRow: null, filter: '', cellFilter: null, openRows: [], panel: null, mode: 'nav' })
}

const TABS: Array<{ id: Screen; label: string }> = [
  { id: 'stock', label: '在庫' },
  { id: 'history', label: '購入歴あり' },
  { id: 'new', label: '新規作成' },
  { id: 'active', label: '作成中' },
  { id: 'done', label: '完了案件' },
]

export function TopNav() {
  const s = useStore()
  const n = (done: boolean) => s.ws.projects.filter((p) => p.completed === done).length
  const user = s.ws.user
  const cur = s.ws.projects.find((p) => p.id === s.ws.currentProjectId)
  return (
    <nav className="topnav" data-testid="topnav">
      <span className="brand">BOM Pro</span>
      {TABS.map((t) => {
        const on = s.screen === t.id || (s.screen === 'project' && t.id === (cur?.completed ? 'done' : 'active'))
        const count = t.id === 'active' ? n(false) : t.id === 'done' ? n(true) : t.id === 'stock' ? s.ws.stock.length : null
        return (
          <button key={t.id} className={'tab' + (on ? ' on' : '')} aria-current={on} onClick={() => goScreen(t.id)} data-testid={`tab-${t.id}`}>
            {t.label}
            {count != null && <span className="cnt">{count}</span>}
          </button>
        )
      })}
      <span className="grow" />
      <span className="role" title="役割（ログイン）">
        {ROLES.map((r) => (
          <button key={r} tabIndex={-1} aria-pressed={user.role === r} onClick={() => user.role !== r && switchRole(r)} data-testid={`role-${r}`}>
            {ROLE_LABEL[r]}
          </button>
        ))}
      </span>
    </nav>
  )
}

export function Home() {
  const s = useStore()
  return (
    <div className="home" data-testid={`screen-${s.screen}`}>
      {s.screen === 'stock' && <StockScreen />}
      {s.screen === 'history' && <HistoryScreen />}
      {s.screen === 'new' && <NewProjectScreen />}
      {(s.screen === 'active' || s.screen === 'done') && <ProjectList done={s.screen === 'done'} />}
      {s.toast && Date.now() - s.toast.at < 6000 && (
        <div className={'toast-float ' + s.toast.kind} role={s.toast.kind === 'err' ? 'alert' : 'status'} data-testid="toast-float">
          {s.toast.text}
        </div>
      )}
    </div>
  )
}

// ---------- 案件の一覧（作成中・完了案件） ----------

function ProjectList({ done }: { done: boolean }) {
  const s = useStore()
  const [q, setQ] = useState('')
  const [armed, setArmed] = useState<string | null>(null)
  const list = useMemo(() => {
    const key = (p: Project) => (done ? (p.completedAt ?? p.updatedAt) : p.updatedAt)
    const qq = q.trim().toLowerCase()
    return s.ws.projects
      .filter((p) => p.completed === done)
      .filter((p) => !qq || `${p.id} ${p.customer} ${p.name}`.toLowerCase().includes(qq))
      .sort((a, b) => key(b).localeCompare(key(a)))
  }, [s.ws.projects, q, done])
  const total = s.ws.projects.filter((p) => p.completed === done).length
  return (
    <section className="home-sec">
      <div className="home-head">
        <h2>{done ? '完了案件' : '作成中'}</h2>
        <input className="home-search" placeholder="案件番号・客先・装置名で絞り込み" value={q} onChange={(e) => setQ(e.target.value)} data-testid="project-search" />
        {!done && (
          <button className="btn primary" onClick={() => goScreen('new')}>
            ＋ 新規作成
          </button>
        )}
      </div>
      {list.length === 0 ? (
        <div className="home-empty" data-testid="project-empty">
          {total === 0 ? (
            done ? (
              <>完了した案件はまだありません。作成中の案件の「完了にする」を押すと、ここに移ります。</>
            ) : (
              <>
                作成中の案件はありません。<br />
                「新規作成」で、案件番号（例 A123456）・客先・装置名を登録してください。<br />
                <button className="btn" style={{ marginTop: 10 }} onClick={() => st().commitWs('サンプルの案件・在庫・購入歴を入れました', (ws) => void addSampleTo(ws))} data-testid="add-sample">
                  サンプルを入れて試す
                </button>
              </>
            )
          ) : (
            <>「{q}」に当てはまる案件はありません。</>
          )}
        </div>
      ) : (
        <table className="home-table" data-testid="project-table">
          <thead>
            <tr>
              <th>案件番号</th>
              <th>客先</th>
              <th>装置名</th>
              <th className="num">部品数</th>
              <th>状況</th>
              <th>{done ? '完了日' : '更新日'}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => {
              const rows = p.rows.filter(isActive).length
              const bc = ballCounts(p)
              return (
                <tr key={p.id} className="clickable-row" onClick={() => openProject(p.id)} data-testid={`project-${p.id}`}>
                  <td className="mono strong">{p.id}</td>
                  <td>{p.customer || <span className="muted">（客先なし）</span>}</td>
                  <td>{p.name}</td>
                  <td className="num">{rows}</td>
                  <td>
                    {done ? (
                      <span className="muted">完了</span>
                    ) : rows === 0 ? (
                      <span className="muted">部品なし</span>
                    ) : (
                      <>
                        <span className="chip">設計待ち {bc.design}</span> <span className="chip">購買待ち {bc.purchasing}</span>
                      </>
                    )}
                  </td>
                  <td className="mono muted">{(done ? (p.completedAt ?? p.updatedAt) : p.updatedAt).slice(0, 10)}</td>
                  <td className="actions" onClick={(e) => e.stopPropagation()}>
                    <button className="btn" onClick={() => openProject(p.id)} data-testid={`open-${p.id}`}>開く</button>
                    <button className="btn" onClick={() => stock.setProjectCompleted(p.id, !done)} data-testid={`${done ? 'reopen' : 'complete'}-${p.id}`}>
                      {done ? '作成中に戻す' : '完了にする'}
                    </button>
                    {armed === p.id ? (
                      <button className="btn danger" onClick={() => { setArmed(null); stock.deleteProject(p.id) }} onBlur={() => setArmed(null)} autoFocus data-testid={`delete-confirm-${p.id}`}>
                        本当に削除
                      </button>
                    ) : (
                      <button className="btn" onClick={() => setArmed(p.id)} data-testid={`delete-${p.id}`}>
                        削除
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}

// ---------- 新規作成（案件の登録） ----------

function NewProjectScreen() {
  const s = useStore()
  const [no, setNo] = useState('')
  const [customer, setCustomer] = useState('')
  const [device, setDevice] = useState('')
  const [error, setError] = useState('')
  const submit = () => {
    const r = stock.createProject(no, customer, device)
    if ('error' in r) return setError(r.error)
    setError('')
    st().toastMsg(`${r.id} を登録しました。作成中の一覧にあります`, 'ok')
    goScreen('active')
  }
  return (
    <section className="home-sec narrow">
      <div className="home-head">
        <h2>新規作成（案件の登録）</h2>
      </div>
      <form
        className="home-form"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <label>
          案件番号
          <input value={no} onChange={(e) => setNo(e.target.value)} placeholder="例 A123456" autoFocus data-testid="new-no" />
        </label>
        <label>
          客先
          <input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="例 〇〇株式会社" data-testid="new-customer" />
        </label>
        <label>
          装置名
          <input value={device} onChange={(e) => setDevice(e.target.value)} placeholder="例 検査装置 1 号機" data-testid="new-device" />
        </label>
        {error && (
          <div className="err-text" role="alert" data-testid="new-error">
            {error}
          </div>
        )}
        <div className="row-actions">
          <button className="btn primary" type="submit" data-testid="new-submit">
            登録する
          </button>
          <span className="muted">登録した案件は「作成中」に並びます（いま {s.ws.projects.filter((p) => !p.completed).length} 件）</span>
        </div>
      </form>
      <PanelStudioImport />
    </section>
  )
}

// ---------- 在庫 ----------

const EMPTY_STOCK = { name: '', model: '', maker: '', qty: '', unit: '個', location: '', note: '' }

function StockScreen() {
  const s = useStore()
  const [q, setQ] = useState('')
  const [form, setForm] = useState<{ id: string | null; v: typeof EMPTY_STOCK } | null>(null)
  const [err, setErr] = useState('')
  const [importing, setImporting] = useState(false)
  const [text, setText] = useState('')
  const [pick, setPick] = useState<PickTarget | null>(null)
  const [armed, setArmed] = useState<string | null>(null)
  const list = useMemo(() => {
    const qq = q.trim().toLowerCase()
    return s.ws.stock.filter((x) => !qq || `${x.name} ${x.model} ${x.maker} ${x.location}`.toLowerCase().includes(qq))
  }, [s.ws.stock, q])
  const save = () => {
    if (!form) return
    const e = form.id ? stock.updateStock(form.id, form.v) : stock.addStock(form.v)
    if (e) return setErr(e)
    setErr('')
    setForm(null)
  }
  return (
    <section className="home-sec">
      <div className="home-head">
        <h2>在庫</h2>
        <input className="home-search" placeholder="部品名・型式・メーカー・置き場所で絞り込み" value={q} onChange={(e) => setQ(e.target.value)} data-testid="stock-search" />
        <button className="btn primary" onClick={() => { setForm({ id: null, v: EMPTY_STOCK }); setErr(''); setImporting(false) }} data-testid="stock-add">
          ＋ 在庫を追加
        </button>
        <button className="btn" onClick={() => { setImporting(!importing); setForm(null) }} data-testid="stock-import-toggle">
          Excel から取り込む
        </button>
      </div>
      <div className="home-hint">部品の行をクリックすると、数量を決めて作成中の案件に追加できます。</div>
      {form && (
        <div className="home-card" data-testid="stock-form">
          <div className="form-grid">
            <Field label="部品名" v={form.v.name} on={(x) => setForm({ ...form, v: { ...form.v, name: x } })} tid="stock-f-name" />
            <Field label="型式" v={form.v.model} on={(x) => setForm({ ...form, v: { ...form.v, model: x } })} tid="stock-f-model" />
            <Field label="メーカー" v={form.v.maker} on={(x) => setForm({ ...form, v: { ...form.v, maker: x } })} tid="stock-f-maker" />
            <Field label="在庫数" v={form.v.qty} on={(x) => setForm({ ...form, v: { ...form.v, qty: x } })} tid="stock-f-qty" />
            <label>
              単位
              <select value={form.v.unit} onChange={(e) => setForm({ ...form, v: { ...form.v, unit: e.target.value } })}>
                {['個', '本', 'm', 'セット', 'パック', '式'].map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </label>
            <Field label="置き場所" v={form.v.location} on={(x) => setForm({ ...form, v: { ...form.v, location: x } })} tid="stock-f-location" />
            <Field label="備考" v={form.v.note} on={(x) => setForm({ ...form, v: { ...form.v, note: x } })} tid="stock-f-note" wide />
          </div>
          {err && <div className="err-text" data-testid="stock-error">{err}</div>}
          <div className="row-actions">
            <button className="btn primary" onClick={save} data-testid="stock-save">保存</button>
            <button className="btn" onClick={() => setForm(null)}>キャンセル</button>
          </div>
        </div>
      )}
      {importing && (
        <div className="home-card" data-testid="stock-import">
          <div className="muted">Excel の表（1 行目に「部品名・型式・メーカー・数量」など）をコピーして貼り付けます。同じ型式・メーカーは数量を足します。</div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder="ここに貼り付け（Ctrl+V）" data-testid="stock-import-text" />
          <div className="row-actions">
            <button className="btn primary" onClick={() => { const m = stock.importStock(text); st().toastMsg(m, /^取り込め/.test(m) ? 'err' : 'ok'); if (!/^取り込め/.test(m)) { setText(''); setImporting(false) } }} data-testid="stock-import-go">
              取り込む
            </button>
            <button className="btn" onClick={() => setImporting(false)}>閉じる</button>
          </div>
        </div>
      )}
      {list.length === 0 ? (
        <div className="home-empty" data-testid="stock-empty">
          {s.ws.stock.length === 0 ? <>在庫はまだ登録されていません。「＋ 在庫を追加」か「Excel から取り込む」で登録してください。</> : <>「{q}」に当てはまる在庫はありません。</>}
        </div>
      ) : (
        <table className="home-table" data-testid="stock-table">
          <thead>
            <tr>
              <th>部品名</th>
              <th>型式</th>
              <th>メーカー</th>
              <th className="num">在庫数</th>
              <th className="num" title="作成中の案件に追加済みの数">引当</th>
              <th className="num">残り</th>
              <th>置き場所</th>
              <th>備考</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((x) => {
              const al = stock.allocatedOf(s.ws, x.id)
              const left = x.qty - al
              return (
                <tr key={x.id} className="clickable-row" onClick={() => setPick({ kind: 'stock', item: x })} data-testid={`stock-${x.id}`}>
                  <td>{x.name}</td>
                  <td className="mono">{x.model}</td>
                  <td>{x.maker}</td>
                  <td className="num">{x.qty}{x.unit !== '個' ? ` ${x.unit}` : ''}</td>
                  <td className="num">{al || ''}</td>
                  <td className={'num' + (left < 0 ? ' warn-text' : '')}>{left}</td>
                  <td>{x.location}</td>
                  <td className="muted">{x.note}</td>
                  <td className="actions" onClick={(e) => e.stopPropagation()}>
                    <button className="btn" onClick={() => setPick({ kind: 'stock', item: x })} data-testid={`stock-pick-${x.id}`}>案件へ追加</button>
                    <button className="btn" onClick={() => { setForm({ id: x.id, v: { name: x.name, model: x.model, maker: x.maker, qty: String(x.qty), unit: x.unit, location: x.location, note: x.note } }); setErr(''); setImporting(false) }}>編集</button>
                    {armed === x.id ? (
                      <button className="btn danger" autoFocus onBlur={() => setArmed(null)} onClick={() => { setArmed(null); stock.deleteStock(x.id) }}>本当に削除</button>
                    ) : (
                      <button className="btn" onClick={() => setArmed(x.id)}>削除</button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      {pick && <AddDialog target={pick} onClose={() => setPick(null)} />}
    </section>
  )
}

function Field({ label, v, on, tid, wide }: { label: string; v: string; on: (x: string) => void; tid: string; wide?: boolean }) {
  return (
    <label className={wide ? 'wide' : ''}>
      {label}
      <input value={v} onChange={(e) => on(e.target.value)} data-testid={tid} />
    </label>
  )
}

// ---------- 購入歴あり ----------

const EMPTY_PURCHASE = { name: '', model: '', maker: '', unitPrice: '', supplier: '', date: '' }

function HistoryScreen() {
  const s = useStore()
  const [q, setQ] = useState('')
  const [form, setForm] = useState<typeof EMPTY_PURCHASE | null>(null)
  const [err, setErr] = useState('')
  const [importing, setImporting] = useState(false)
  const [text, setText] = useState('')
  const [impSup, setImpSup] = useState('')
  const [impDate, setImpDate] = useState('')
  const [pick, setPick] = useState<PickTarget | null>(null)
  const [armed, setArmed] = useState<string | null>(null)
  const all = useMemo(() => stock.purchaseHistory(s.ws), [s.ws])
  const list = useMemo(() => {
    const qq = q.trim().toLowerCase()
    return all.filter((x) => !qq || `${x.name} ${x.model} ${x.maker} ${x.lastSupplier}`.toLowerCase().includes(qq))
  }, [all, q])
  return (
    <section className="home-sec">
      <div className="home-head">
        <h2>購入歴あり</h2>
        <input className="home-search" placeholder="部品名・型式・メーカー・商社で絞り込み" value={q} onChange={(e) => setQ(e.target.value)} data-testid="history-search" />
        <button className="btn primary" onClick={() => { setForm(EMPTY_PURCHASE); setErr(''); setImporting(false) }} data-testid="history-add">
          ＋ 購入歴を追加
        </button>
        <button className="btn" onClick={() => { setImporting(!importing); setForm(null) }} data-testid="history-import-toggle">
          Excel から取り込む
        </button>
      </div>
      <div className="home-hint">過去に買った部品です。発注した部品は自動で入ります。部品の行をクリックすると、数量を決めて作成中の案件に追加できます（前回の単価・商社は備考に入ります）。</div>
      {form && (
        <div className="home-card" data-testid="history-form">
          <div className="form-grid">
            <Field label="部品名" v={form.name} on={(x) => setForm({ ...form, name: x })} tid="history-f-name" />
            <Field label="型式" v={form.model} on={(x) => setForm({ ...form, model: x })} tid="history-f-model" />
            <Field label="メーカー" v={form.maker} on={(x) => setForm({ ...form, maker: x })} tid="history-f-maker" />
            <Field label="単価（円）" v={form.unitPrice} on={(x) => setForm({ ...form, unitPrice: x })} tid="history-f-price" />
            <Field label="購入した商社" v={form.supplier} on={(x) => setForm({ ...form, supplier: x })} tid="history-f-supplier" />
            <Field label="購入日（例 2026-05-12）" v={form.date} on={(x) => setForm({ ...form, date: x })} tid="history-f-date" />
          </div>
          {err && <div className="err-text" data-testid="history-error">{err}</div>}
          <div className="row-actions">
            <button className="btn primary" onClick={() => { const e = stock.addPurchase(form); if (e) return setErr(e); setErr(''); setForm(null) }} data-testid="history-save">保存</button>
            <button className="btn" onClick={() => setForm(null)}>キャンセル</button>
          </div>
        </div>
      )}
      {importing && (
        <div className="home-card" data-testid="history-import">
          <div className="muted">Excel の表（1 行目に「部品名・型式・メーカー・数量」など）を貼り付けます。商社・購入日は全部の行に同じものを入れます。</div>
          <div className="form-grid">
            <Field label="購入した商社（任意）" v={impSup} on={setImpSup} tid="history-imp-supplier" />
            <Field label="購入日（任意。例 2026-05-12）" v={impDate} on={setImpDate} tid="history-imp-date" />
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder="ここに貼り付け（Ctrl+V）" data-testid="history-import-text" />
          <div className="row-actions">
            <button className="btn primary" onClick={() => { const m = stock.importPurchases(text, impSup, impDate); st().toastMsg(m, /^取り込め/.test(m) ? 'err' : 'ok'); if (!/^取り込め/.test(m)) { setText(''); setImporting(false) } }} data-testid="history-import-go">
              取り込む
            </button>
            <button className="btn" onClick={() => setImporting(false)}>閉じる</button>
          </div>
        </div>
      )}
      {list.length === 0 ? (
        <div className="home-empty" data-testid="history-empty">
          {all.length === 0 ? <>購入歴はまだありません。案件で発注すると自動で入ります。過去の購入は「＋ 購入歴を追加」か「Excel から取り込む」で入れられます。</> : <>「{q}」に当てはまる購入歴はありません。</>}
        </div>
      ) : (
        <table className="home-table" data-testid="history-table">
          <thead>
            <tr>
              <th>部品名</th>
              <th>型式</th>
              <th>メーカー</th>
              <th className="num">前回単価</th>
              <th>前回の商社</th>
              <th>最後の購入日</th>
              <th className="num">購入回数</th>
              <th>使った案件</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((x) => (
              <tr key={x.key} className="clickable-row" onClick={() => setPick({ kind: 'history', entry: x })} data-testid={`history-${x.key}`}>
                <td>{x.name}</td>
                <td className="mono">{x.model}</td>
                <td>{x.maker}</td>
                <td className="num">{x.lastPrice != null ? `¥${x.lastPrice.toLocaleString()}` : ''}</td>
                <td>{x.lastSupplier}</td>
                <td className="mono">{x.lastDate}</td>
                <td className="num">{x.count}</td>
                <td className="muted">{x.projects.join(' ')}</td>
                <td className="actions" onClick={(e) => e.stopPropagation()}>
                  <button className="btn" onClick={() => setPick({ kind: 'history', entry: x })} data-testid={`history-pick-${x.key}`}>案件へ追加</button>
                  {x.recordIds.length > 0 &&
                    (armed === x.key ? (
                      <button className="btn danger" autoFocus onBlur={() => setArmed(null)} onClick={() => { setArmed(null); stock.deletePurchaseRecords(x.recordIds) }}>本当に削除</button>
                    ) : (
                      <button className="btn" onClick={() => setArmed(x.key)} title="取り込んだ・手で入れた購入歴を消します（発注した分は消えません）">取込分を削除</button>
                    ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {pick && <AddDialog target={pick} onClose={() => setPick(null)} />}
    </section>
  )
}

// ---------- 数量を決めて作成中の案件に追加 ----------

type PickTarget = { kind: 'stock'; item: StockItem } | { kind: 'history'; entry: PurchaseEntry }

let lastProject = ''

function AddDialog({ target, onClose }: { target: PickTarget; onClose: () => void }) {
  const s = useStore()
  const active = s.ws.projects.filter((p) => !p.completed).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const [qty, setQty] = useState('1')
  const [pid, setPid] = useState(active.some((p) => p.id === lastProject) ? lastProject : active.length === 1 ? active[0].id : '')
  const [err, setErr] = useState('')
  const [added, setAdded] = useState<{ projectId: string; text: string; kind: 'stock' | 'history' } | null>(null)
  const title = target.kind === 'stock' ? [target.item.name, target.item.model].filter(Boolean).join('　') : [target.entry.name, target.entry.model].filter(Boolean).join('　')
  const maker = target.kind === 'stock' ? target.item.maker : target.entry.maker
  const unit = target.kind === 'stock' ? target.item.unit : target.entry.unit
  const left = target.kind === 'stock' ? target.item.qty - stock.allocatedOf(s.ws, target.item.id) : null
  const qn = Number(qty)
  const short = left != null && Number.isFinite(qn) && qn > left
  const submit = () => {
    if (!pid) return setErr('追加する案件の番号を選んでください')
    const r = stock.addPartToProject(target.kind === 'stock' ? { kind: 'stock', id: target.item.id } : { kind: 'history', entry: target.entry }, qty, pid)
    if ('error' in r) return setErr(r.error)
    lastProject = pid
    setErr('')
    setAdded({ projectId: pid, kind: target.kind, text: `${pid} に ${title} × ${qty}${unit} を追加しました` })
  }
  return (
    <div className="overlay" onClick={onClose} data-testid="add-dialog">
      <div className="dialog add-dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3>作成中の案件に追加</h3>
        <div className="part-title">{title}</div>
        <div className="muted">{[maker, target.kind === 'stock' ? `在庫 ${target.item.qty}${unit}・引当 ${stock.allocatedOf(s.ws, target.item.id)}・残り ${left}` : target.entry.lastPrice != null ? `前回 ¥${target.entry.lastPrice.toLocaleString()} ${target.entry.lastSupplier}` : ''].filter(Boolean).join('　')}</div>
        {added ? (
          <>
            <div className="ok-box" data-testid="add-done">{added.text}</div>
            <div className="row-actions">
              <button className="btn primary" onClick={() => { onClose(); openProject(added.projectId, added.kind === 'stock' ? 1 : 2) }} data-testid="add-open-project">案件を開く</button>
              <button className="btn" onClick={() => { setAdded(null); setQty('1') }} data-testid="add-more">続けて追加</button>
              <button className="btn" onClick={onClose} data-testid="add-close">閉じる</button>
            </div>
          </>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); submit() }}>
            <label>
              数量（{unit}）
              <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" autoFocus onFocus={(e) => e.target.select()} data-testid="add-qty" />
            </label>
            {short && <div className="warn-text" data-testid="add-short">在庫の残り（{left}）より多い数量です。足りない分は購買で手配することになります。</div>}
            <div className="field-label">案件番号を選ぶ（作成中の案件）</div>
            {active.length === 0 ? (
              <div className="home-empty small">
                作成中の案件がありません。先に「新規作成」で案件を登録してください。
                <br />
                <button className="btn" type="button" onClick={() => { onClose(); goScreen('new') }}>新規作成へ</button>
              </div>
            ) : (
              <div className="pick-list" role="radiogroup" data-testid="add-projects">
                {active.map((p) => (
                  <button type="button" key={p.id} role="radio" aria-checked={pid === p.id} className={'pick' + (pid === p.id ? ' on' : '')} onClick={() => setPid(p.id)} data-testid={`add-project-${p.id}`}>
                    <span className="mono strong">{p.id}</span>
                    <span>{p.customer}</span>
                    <span className="muted">{p.name}</span>
                  </button>
                ))}
              </div>
            )}
            {err && <div className="err-text" role="alert" data-testid="add-error">{err}</div>}
            <div className="row-actions">
              <button className="btn primary" type="submit" disabled={active.length === 0} data-testid="add-submit">追加する</button>
              <button className="btn" type="button" onClick={onClose}>キャンセル</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

/** Panel Studio で設計完了したときに出る部品表（ZIP の中の _bom.json、または JSON そのもの）から案件を作る */
function PanelStudioImport() {
  const [data, setData] = useState<PanelStudioBom | null>(null)
  const [fileName, setFileName] = useState('')
  const [no, setNo] = useState('')
  const [customer, setCustomer] = useState('')
  const [device, setDevice] = useState('')
  const [error, setError] = useState('')
  const target = no ? stock.panelStudioTarget(no) : { exists: false, completed: false }
  const pick = async (file: File | undefined) => {
    if (!file) return
    const r = await readPanelStudioFile(file)
    if (!r.ok) {
      setData(null)
      return setError(r.error)
    }
    setError('')
    setData(r.data)
    setFileName(file.name)
    setNo(r.data.jobNo)
    setCustomer(r.data.company)
    setDevice(r.data.deviceName)
  }
  const go = () => {
    if (!data) return
    const r = stock.importPanelStudio(data, no, customer, device)
    if ('error' in r) return setError(r.error)
    st().toastMsg(`${r.id}: ${r.added} 行を取り込みました${r.created ? '（案件を新しく登録）' : '（既存の案件に追加）'}${r.skipped ? `。同じ型式などで飛ばした行 ${r.skipped}` : ''}`, 'ok')
    openProject(r.id)
  }
  return (
    <div className="home-card" style={{ marginTop: 24 }} data-testid="ps-import">
      <h3 style={{ margin: '0 0 6px' }}>Panel Studio から取り込む</h3>
      <p className="muted" style={{ margin: '0 0 10px' }}>
        Panel Studio で「設計完了」したときに出る ZIP（または中の「〇〇_bom.json」）を選ぶと、案件と部品の行がまとめて入ります。
      </p>
      <input type="file" accept=".zip,.json,application/json,application/zip" onChange={(e) => void pick(e.target.files?.[0])} data-testid="ps-file" />
      {error && (
        <div className="err-text" role="alert" data-testid="ps-error" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}
      {data && (
        <div data-testid="ps-preview" style={{ marginTop: 12 }}>
          <div className="muted">
            {fileName}: 部品 {data.lines.length} 行{data.skipped ? `（読めない ${data.skipped} 行は飛ばします）` : ''}
          </div>
          <div className="form-grid" style={{ margin: '10px 0' }}>
            <label>
              案件番号
              <input value={no} onChange={(e) => setNo(e.target.value)} placeholder="例 A123456" data-testid="ps-no" />
            </label>
            <label>
              客先
              <input value={customer} onChange={(e) => setCustomer(e.target.value)} data-testid="ps-customer" disabled={target.exists} />
            </label>
            <label>
              装置名
              <input value={device} onChange={(e) => setDevice(e.target.value)} data-testid="ps-device" disabled={target.exists} />
            </label>
          </div>
          {target.exists && !target.completed && <div className="muted">この案件番号はもうあります。部品の行を追加します（同じメーカー・型式の行は飛ばします）。</div>}
          {target.completed && <div className="err-text">この案件番号は完了案件です。作成中に戻すか、別の番号にしてください。</div>}
          <table className="home-table" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>部品名</th>
                <th>型式</th>
                <th>メーカー</th>
                <th className="num">数量</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.slice(0, 50).map((l, i) => (
                <tr key={i}>
                  <td>{l.name}{l.derived ? ' （派生）' : ''}</td>
                  <td className="mono">{l.model}</td>
                  <td>{l.maker}</td>
                  <td className="num">{l.qty} {l.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.lines.length > 50 && <div className="muted">ほか {data.lines.length - 50} 行</div>}
          <div className="row-actions" style={{ marginTop: 10 }}>
            <button className="btn primary" onClick={go} disabled={target.completed} data-testid="ps-go">
              {target.exists ? '案件に追加して開く' : '案件を作って取り込む'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
