// ラウンド22: 解析の旧（OLD、既定は r21 の測定ビルド 56e5aba）と新（今の src）を 1 回ビルドして読み込む共通部品
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
const ROOT = '/home/user/BOM'
const CACHE = process.env.PARSE_CACHE || '/tmp/claude-0/-home-user-BOM/cac18a95-603a-5fc7-89ba-5680a1690c60/scratchpad/parsecache'
export async function loadParsers(oldRev = process.env.OLD || '56e5aba') {
  fs.mkdirSync(CACHE, { recursive: true })
  const head = execSync(`git -C ${ROOT} rev-parse HEAD`).toString().trim()
  const dirty = execSync(`git -C ${ROOT} diff --stat -- src | wc -l`).toString().trim()
  const srcStamp = execSync(`git -C ${ROOT} log -1 --format=%h -- src`).toString().trim() + ':' + dirty
  const oldDir = path.join(CACHE, 'old_' + oldRev)
  if (!fs.existsSync(path.join(oldDir, 'paste.mjs'))) {
    fs.mkdirSync(path.join(oldDir, 'x'), { recursive: true })
    execSync(`git -C ${ROOT} archive ${oldRev} src | tar -x -C ${oldDir}/x`)
    if (!fs.existsSync(path.join(oldDir, 'x/node_modules'))) fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(oldDir, 'x/node_modules'))
    execSync(`${ROOT}/node_modules/.bin/esbuild ${oldDir}/x/src/io/paste.ts --bundle --format=esm --platform=node --alias:@=${oldDir}/x/src --external:exceljs --outfile=${oldDir}/paste.mjs --log-level=error`)
  }
  const newOut = path.join(CACHE, `new_${srcStamp.replace(/[^\w]/g, '_')}.mjs`)
  if (!fs.existsSync(newOut)) execSync(`${ROOT}/node_modules/.bin/esbuild ${ROOT}/src/io/paste.ts --bundle --format=esm --platform=node --alias:@=${ROOT}/src --external:exceljs --outfile=${newOut} --log-level=error`)
  return { old: await import(path.join(oldDir, 'paste.mjs')), neu: await import(newOut), head }
}
export const T = (s) => s.trim().split('\n').map((l) => l.trim().split('｜').join('\t')).join('\n')
/** 行の見た目（型式 || 部品名 : 数量、【削除？】なら ?） */
export const lab = (r) => `${r.model || r.name || ''}:${r.qtyNeeded}${String(r.note ?? '').startsWith('【削除？】') ? '?' : ''}`
