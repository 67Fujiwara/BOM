import JSZip from 'jszip'
import type { Unit } from '@/model/types'
import { UNITS } from '@/model/types'

/** Panel Studio が設計完了のときに出す部品表の JSON（`<案件>_bom.json`）の形式名 */
export const PANEL_STUDIO_BOM_FORMAT = 'panel-studio/bom'

export interface PanelStudioLine {
  model: string
  maker: string
  name: string
  qty: number
  unit: Unit
  /** device: 機器本体 / derived: DINレール・ダクトなどの派生部品 */
  derived: boolean
}

export interface PanelStudioBom {
  /** 案件番号（Panel Studio の設計完了で入れたもの。BOM Pro の形式に合わないこともある） */
  jobNo: string
  company: string
  owner: string
  completedAt: string
  /** 装置名の候補（盤の名前・型式） */
  deviceName: string
  lines: PanelStudioLine[]
  /** 読めなかった行の数 */
  skipped: number
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')

/** JSON の文字列を読む。BOM Pro 用の部品表でなければ理由を返す */
export function parsePanelStudioBom(text: string): { ok: true; data: PanelStudioBom } | { ok: false; error: string } {
  let raw: unknown
  try {
    raw = JSON.parse(text.replace(/^﻿/, ''))
  } catch {
    return { ok: false, error: 'JSON として読めません（Panel Studio の設計完了で出たファイルを選んでください）' }
  }
  if (!isObj(raw)) return { ok: false, error: 'Panel Studio の部品表ではありません' }
  if (raw.format === 'panel-studio/electracad-sheets') return { ok: false, error: 'これは ElectraCAD 用の図面ファイルです。同じ ZIP の中の「〇〇_bom.json」を選んでください' }
  if (raw.format !== PANEL_STUDIO_BOM_FORMAT) return { ok: false, error: `Panel Studio の部品表（format: ${PANEL_STUDIO_BOM_FORMAT}）ではありません` }
  if (raw.version !== 1) return { ok: false, error: `未対応の版です（version: ${String(raw.version)}）。BOM Pro を新しくしてください` }
  if (!Array.isArray(raw.lines)) return { ok: false, error: '部品の行（lines）がありません' }
  const job = isObj(raw.job) ? raw.job : {}
  const panel = isObj(raw.panel) ? raw.panel : {}
  const lines: PanelStudioLine[] = []
  let skipped = 0
  for (const l of raw.lines) {
    if (!isObj(l)) {
      skipped++
      continue
    }
    const model = str(l.model)
    const name = str(l.name)
    const qty = Number(l.qty)
    if ((!model && !name) || !Number.isFinite(qty) || qty <= 0) {
      skipped++
      continue
    }
    const u = str(l.unit)
    lines.push({ model, maker: str(l.maker), name, qty, unit: (UNITS as string[]).includes(u) ? (u as Unit) : '個', derived: l.source === 'derived' })
  }
  if (!lines.length) return { ok: false, error: '取り込める部品の行がありません' }
  return {
    ok: true,
    data: {
      jobNo: str(job.jobNo),
      company: str(job.company),
      owner: str(job.owner),
      completedAt: str(job.completedAt),
      deviceName: str(raw.deviceName) || str(panel.name) || str(panel.model),
      lines,
      skipped,
    },
  }
}

/** 選んだファイルから部品表を読む。JSON そのものでも、設計完了の ZIP（中の `_bom.json` を探す）でもよい */
export async function readPanelStudioFile(file: File): Promise<{ ok: true; data: PanelStudioBom } | { ok: false; error: string }> {
  try {
    if (/\.zip$/i.test(file.name)) {
      const zip = await JSZip.loadAsync(await file.arrayBuffer())
      const entry = Object.values(zip.files).find((f) => !f.dir && /_bom\.json$/i.test(f.name))
      if (!entry) return { ok: false, error: 'ZIP の中に「〇〇_bom.json」がありません（Panel Studio を新しくして、設計完了をやり直してください）' }
      return parsePanelStudioBom(await entry.async('string'))
    }
    return parsePanelStudioBom(await file.text())
  } catch {
    return { ok: false, error: `${file.name} を読めませんでした` }
  }
}
