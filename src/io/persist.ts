import type { User, Workspace } from '@/model/types'
import { sanitizeWorkspace } from '@/model/validate'

export const STORAGE_KEY = 'bom-pro.workspace.v2'
const USER_KEY = 'bom-pro.user'
const SYNC_URL: string | undefined = (import.meta as unknown as { env: Record<string, string | undefined> }).env.VITE_SYNC_URL

let timer: number | undefined
let lastSavedVersion = ''
let lastWritten = ''

/** 役割（ログイン）はタブごと。別タブで別の役割を開いても混ざらない */
export function loadUser(): User | null {
  try {
    const raw = sessionStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}
export function saveUser(u: User) {
  try {
    sessionStorage.setItem(USER_KEY, JSON.stringify(u))
  } catch {
    /* noop */
  }
}

export function parseWorkspace(raw: string | null): Workspace | null {
  if (!raw) return null
  try {
    const r = sanitizeWorkspace(JSON.parse(raw))
    return r.ws ?? null
  } catch {
    return null
  }
}

// ---------- 退避 ----------
// 読めなかった保存データ・JSON 読み込みで置き換える前のデータを 1 つだけ退避しておく（上書きで失わないように）
export const BACKUP_KEY = 'bom-pro.workspace.backup'
export interface Backup {
  at: string
  reason: string
  raw: string
}
export function saveBackup(raw: string, reason: string): boolean {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify({ at: new Date().toISOString(), reason, raw } satisfies Backup))
    return true
  } catch {
    return false
  }
}
export function loadBackup(): Backup | null {
  try {
    const b = JSON.parse(localStorage.getItem(BACKUP_KEY) ?? 'null')
    return b && typeof b.raw === 'string' ? (b as Backup) : null
  } catch {
    return null
  }
}
/** 起動時に保存データを読めなかった・一部を外したときの説明（画面が出たら通知する） */
export let loadProblem: string | null = null

export function loadWorkspace(): Workspace | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    lastWritten = raw ?? ''
    if (!raw) return null
    let res: ReturnType<typeof sanitizeWorkspace>
    try {
      res = sanitizeWorkspace(JSON.parse(raw))
    } catch (e) {
      res = { error: `JSON として読めません（${(e as Error).message}）` }
    }
    if (!res.ws || res.warnings?.length) {
      const saved = saveBackup(raw, res.ws ? '一部を外して読み込み' : '読めなかった保存データ')
      const where = saved ? '元のデータは退避しました（Ctrl+K →「退避したデータを書き出す」）' : '元のデータを退避できませんでした（ブラウザの容量不足）'
      loadProblem = res.ws ? `保存データの一部を外して読みました: ${res.warnings!.slice(0, 2).join(' / ')}${res.warnings!.length > 2 ? ` ほか ${res.warnings!.length - 2} 件` : ''}。${where}` : `保存データを読めなかったのでサンプルを表示しています（${res.error}）。${where}`
    }
    const ws = res.ws
    if (!ws) return null
    const u = loadUser()
    if (u) ws.user = u
    return ws
  } catch {
    return null
  }
}

/** 他のタブが保存した最新（自分が最後に書いたものと違えば） */
export function loadIfChangedElsewhere(): Workspace | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw || raw === lastWritten) return null
    lastWritten = raw
    return parseWorkspace(raw)
  } catch {
    return null
  }
}

export function saveWorkspace(ws: Workspace): boolean {
  saveUser(ws.user)
  let ok = true
  try {
    const body = JSON.stringify(ws)
    localStorage.setItem(STORAGE_KEY, body)
    lastWritten = body
  } catch {
    ok = false
  }
  if (SYNC_URL) {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => void pushRemote(ws), 400)
  }
  return ok
}

export function resetWorkspace() {
  try {
    localStorage.removeItem(STORAGE_KEY)
    lastWritten = ''
  } catch {
    /* noop */
  }
}

async function pushRemote(ws: Workspace) {
  try {
    const body = JSON.stringify(ws)
    if (body === lastSavedVersion) return
    const res = await fetch(`${SYNC_URL}/api/workspace`, { method: 'PUT', headers: { 'content-type': 'application/json', 'x-user': encodeURIComponent(ws.user.name) }, body })
    if (res.ok) lastSavedVersion = body
  } catch {
    /* オフライン。次の保存で再送 */
  }
}

/** 共有ストアを監視し、他の人の変更を取り込む */
export function startSync(onRemote: (ws: Workspace) => void) {
  if (!SYNC_URL) return () => {}
  let stamp = ''
  const tick = async () => {
    try {
      const res = await fetch(`${SYNC_URL}/api/workspace?stamp=${encodeURIComponent(stamp)}`)
      if (res.status === 204) return
      if (!res.ok) return
      const newStamp = res.headers.get('x-stamp') ?? ''
      const text = await res.text()
      if (newStamp && newStamp !== stamp) {
        stamp = newStamp
        if (text !== lastSavedVersion) {
          lastSavedVersion = text
          const ws = parseWorkspace(text)
          if (ws) onRemote(ws)
        }
      }
    } catch {
      /* noop */
    }
  }
  void tick()
  const id = window.setInterval(tick, 2500)
  return () => window.clearInterval(id)
}

export function syncEnabled() {
  return !!SYNC_URL
}
