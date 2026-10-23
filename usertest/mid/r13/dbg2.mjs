import { launch, log } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const h = helpers(t)
await t.open('pm'); const p = await t.proj()
for (const r of p.rows.filter((r) => r.flags.leadNG || r.flags.ltbPending || r.status==='selected' && r.procurement!=='相見積')) log(h.show(p, r.id), r.maker)
log(JSON.stringify(p.settings))
await t.close()
