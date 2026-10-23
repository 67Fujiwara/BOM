// ラウンド14（ベテラン）共通部品。r13 と同じく r12 の lib12（→ r11 → … → r6/letterlib）をそのまま使い、出力先だけ r14 に。
import fs from 'node:fs'
export { open, reset, snap, diffRows, panelOf, cursorText, sleep, LS, evInit, typeSeqM, installPrevLog, takePrevLog, gotoCell, cdpKey, state, installToastLog, takeToasts } from '../r12/lib12.mjs'
export const OUT = '/home/user/BOM/usertest/veteran/r14'
export const saveJson = (name, data) => fs.writeFileSync(`${OUT}/${name}`, JSON.stringify(data, null, 2))
export function logger(name) {
  const out = []
  const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 1200)) }
  log.save = () => saveJson(name, out)
  return log
}
