// ラウンド12（ベテラン）共通部品。r11 の lib11（→ r10 → r9 → r8 → r7 → r6/letterlib）をそのまま使い、出力先だけ r12 に。
import fs from 'node:fs'
export { open, reset, snap, diffRows, panelOf, cursorText, sleep, LS, evInit, typeSeqM, installPrevLog, takePrevLog, gotoCell, cdpKey, state, installToastLog, takeToasts } from '../r11/lib11.mjs'
export const OUT = '/home/user/BOM/usertest/veteran/r12'
export const saveJson = (name, data) => fs.writeFileSync(`${OUT}/${name}`, JSON.stringify(data, null, 2))
export function logger(name) {
  const out = []
  const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 900)) }
  log.save = () => saveJson(name, out)
  return log
}
