import type { Workspace } from '@/model/types'

const KEY = 'bom-pro.workspace.v2'
const SYNC_URL: string | undefined = (import.meta as unknown as { env: Record<string, string | undefined> }).env.VITE_SYNC_URL

let timer: number | undefined
let lastSavedVersion = ''

export function loadWorkspace(): Workspace | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const ws = JSON.parse(raw) as Workspace
    if (!ws.projects?.length || !ws.user) return null
    return ws
  } catch {
    return null
  }
}

export function saveWorkspace(ws: Workspace) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ws))
  } catch {
    /* 容量超過など。共有ストアがあればそちらに残る */
  }
  if (SYNC_URL) {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => void pushRemote(ws), 400)
  }
}

export function resetWorkspace() {
  try {
    localStorage.removeItem(KEY)
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
      const ws = (await res.json()) as Workspace
      if (newStamp && newStamp !== stamp) {
        stamp = newStamp
        const body = JSON.stringify(ws)
        if (body !== lastSavedVersion) {
          lastSavedVersion = body
          onRemote(ws)
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
