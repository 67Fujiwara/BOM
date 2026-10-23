// ラウンド10（ベテラン）共通部品。r9 の lib9（→ r8/lib8 → r8/rerun7/lib7 → r6/rerun5/letterlib）をそのまま使い、出力先だけ r10 に。
import fs from 'node:fs'
export { open, reset, snap, diffRows, panelOf, cursorText, sleep, LS, evInit, typeSeqM, installPrevLog, takePrevLog, gotoCell, cdpKey, state, installToastLog, takeToasts } from '../r9/lib9.mjs'
export const OUT = '/home/user/BOM/usertest/veteran/r10'
export const saveJson = (name, data) => fs.writeFileSync(`${OUT}/${name}`, JSON.stringify(data, null, 2))
export function logger(name) {
  const out = []
  const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 900)) }
  log.save = () => saveJson(name, out)
  return log
}
