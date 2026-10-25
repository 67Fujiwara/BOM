// ラウンド18: JSON の行の needOffset（必要日の前倒し日数。画面では -365〜365）が範囲の外（±1e12・-100000・400）のとき、sanitize・必要日・スコア・セルの表示
const S=process.env.SRC ?? '/home/user/BOM/src'
const { sanitizeWorkspace } = await import(S + '/model/validate.ts')
const { makeWorkspace } = await import(S + '/model/sample.ts')
const der = await import(S + '/model/derive.ts')
const score = await import(S + '/model/score.ts')
const sel = await import(S + '/model/selectors.ts')
const { normalize } = await import(S + '/model/lifecycle.ts')
for (const off of [-1e12, 1e12, -100000, 400]) {
const w = JSON.parse(JSON.stringify(makeWorkspace())); w.projects[0].rows.find((r:any)=>r.id==='R006').needOffset = off
const res = sanitizeWorkspace(w); const p = res.ws!.projects[0]; normalize(p, res.ws!)
const r = p.rows.find((x:any)=>x.id==='R006')!
const ctx = sel.makeCtx(res.ws!, p, null)
console.log(off, 'warn', res.warnings, 'need', der.rowNeedDate(p, r), 'score', score.scoreRow(p, r, res.ws!.suppliers).map((s:any)=>s.total), 'cells', ['needDate','due','waiting','lead'].map(c=>JSON.stringify(sel.cellText(r,c,ctx))))
}
