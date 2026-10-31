// 1か所のキー定義表。ヘルプ・パレット・ステータスバーはここから生成する。
export type Mode = 'nav' | 'edit' | 'palette' | 'panel'

export interface KeyBinding {
  /** コマンドID（commands/registry のキー） */
  id: string
  /** 表示用のキー（複数可）。"Ctrl+K" "Shift+A" "a" "ArrowUp" の形式 */
  keys: string[]
  /** どのモードで効くか */
  mode: 'any' | 'nav' | 'edit'
  section: string
  label: string
  /** ステータスバーに出す短い表記 */
  hint?: string
}

export const KEYMAP: KeyBinding[] = [
  // 5.1 全体
  { id: 'palette.open', keys: ['Ctrl+K'], mode: 'any', section: '全体', label: 'コマンドパレットを開く', hint: 'Ctrl+K' },
  { id: 'project.switch', keys: ['Ctrl+P'], mode: 'any', section: '全体', label: '作成中の案件一覧へ' },
  { id: 'project.save', keys: ['Ctrl+S'], mode: 'any', section: '全体', label: '一時保存' },
  { id: 'undo', keys: ['Ctrl+Z'], mode: 'any', section: '全体', label: '元に戻す' },
  { id: 'redo', keys: ['Ctrl+Shift+Z', 'Ctrl+Y'], mode: 'any', section: '全体', label: 'やり直す' },
  { id: 'export.excel', keys: ['Ctrl+E'], mode: 'any', section: '全体', label: 'Excelで出力' },
  { id: 'copy.formatted', keys: ['Ctrl+Shift+C'], mode: 'any', section: '全体', label: '表示中の行と列を書式つきでコピー' },
  { id: 'goto', keys: ['Ctrl+G'], mode: 'any', section: '全体', label: 'ID・型式・Noでジャンプ' },
  { id: 'filter.focus', keys: ['/', 'Ctrl+F'], mode: 'nav', section: '全体', label: '絞り込み検索にフォーカス' },
  { id: 'help', keys: ['?', 'F1'], mode: 'nav', section: '全体', label: 'ショートカット一覧', hint: '?' },
  { id: 'escape', keys: ['Escape'], mode: 'any', section: '全体', label: '1段階戻る' },

  // 5.2 移動
  { id: 'move.up', keys: ['ArrowUp'], mode: 'nav', section: '移動', label: '上のセル' },
  { id: 'move.down', keys: ['ArrowDown'], mode: 'nav', section: '移動', label: '下のセル' },
  { id: 'move.left', keys: ['ArrowLeft'], mode: 'nav', section: '移動', label: '左のセル' },
  { id: 'move.right', keys: ['ArrowRight'], mode: 'nav', section: '移動', label: '右のセル' },
  { id: 'row.next', keys: ['j', 'Shift+J'], mode: 'nav', section: '移動', label: '次の行' },
  { id: 'row.prev', keys: ['k', 'Shift+K'], mode: 'nav', section: '移動', label: '前の行' },
  { id: 'move.tab', keys: ['Tab'], mode: 'nav', section: '移動', label: '右のセル（Tab）' },
  { id: 'move.shiftTab', keys: ['Shift+Tab'], mode: 'nav', section: '移動', label: '左のセル（Shift+Tab）' },
  { id: 'move.home', keys: ['Home'], mode: 'nav', section: '移動', label: '行の先頭のセル' },
  { id: 'move.end', keys: ['End'], mode: 'nav', section: '移動', label: '行の最後のセル' },
  { id: 'move.top', keys: ['Ctrl+ArrowUp', 'Ctrl+Home'], mode: 'nav', section: '移動', label: '表の先頭' },
  { id: 'move.bottom', keys: ['Ctrl+ArrowDown', 'Ctrl+End'], mode: 'nav', section: '移動', label: '表の最後' },
  { id: 'move.pageUp', keys: ['PageUp'], mode: 'nav', section: '移動', label: '1画面ぶん上' },
  { id: 'move.pageDown', keys: ['PageDown'], mode: 'nav', section: '移動', label: '1画面ぶん下' },
  { id: 'row.toggleOpen', keys: [' '], mode: 'nav', section: '移動', label: '行を開く・閉じる（相見積の比較と履歴）', hint: 'Space 開く' },
  { id: 'view.1', keys: ['1'], mode: 'nav', section: '移動', label: 'ビュー: 在庫' },
  { id: 'view.2', keys: ['2'], mode: 'nav', section: '移動', label: 'ビュー: 設計中' },
  { id: 'view.3', keys: ['3'], mode: 'nav', section: '移動', label: 'ビュー: 見積もり' },
  { id: 'category.prev', keys: ['['], mode: 'nav', section: '移動', label: '前の分類へ' },
  { id: 'category.next', keys: [']'], mode: 'nav', section: '移動', label: '次の分類へ' },

  // 5.3 編集
  { id: 'cell.edit', keys: ['Enter', 'F2'], mode: 'nav', section: '編集', label: 'セルを編集', hint: 'Enter 編集' },
  { id: 'cell.clear', keys: ['Delete', 'Backspace'], mode: 'nav', section: '編集', label: 'セルを空にする（Ctrl+Z で戻せる）' },
  { id: 'row.insertBelow', keys: ['Shift+Enter'], mode: 'nav', section: '編集', label: '下に行を追加して部品名を編集' },
  { id: 'row.duplicate', keys: ['Shift+D'], mode: 'nav', section: '編集', label: '行を複製' },
  { id: 'row.delete', keys: ['Shift+Delete'], mode: 'nav', section: '編集', label: '行を削除' },
  { id: 'row.moveUp', keys: ['Alt+ArrowUp'], mode: 'nav', section: '編集', label: '行を1つ上へ' },
  { id: 'row.moveDown', keys: ['Alt+ArrowDown'], mode: 'nav', section: '編集', label: '行を1つ下へ' },
  { id: 'cell.copy', keys: ['Ctrl+C'], mode: 'nav', section: '編集', label: 'セルをコピー' },
  { id: 'cell.paste', keys: ['Ctrl+V'], mode: 'nav', section: '編集', label: '貼り付け（Excelの複数セルも可）' },

  // 5.4 BOM操作
  { id: 'adopt.best', keys: ['a'], mode: 'nav', section: 'BOM操作', label: '推奨（最高スコア）で採用。見積済のみ', hint: 'a 推奨採用' },
  { id: 'adopt.choose', keys: ['Shift+A'], mode: 'nav', section: 'BOM操作', label: '商社を選んで採用（1〜9）' },
  { id: 'row.replace', keys: ['r'], mode: 'nav', section: 'BOM操作', label: '置き換え品を作る', hint: 'r 置換' },
  { id: 'row.toggleOrdered', keys: ['o'], mode: 'nav', section: 'BOM操作', label: '発注済の切り替え', hint: 'o 発注' },
  { id: 'row.toggleReceived', keys: ['i'], mode: 'nav', section: 'BOM操作', label: '入荷済の切り替え', hint: 'i 入荷' },
  { id: 'row.toggleHidden', keys: ['h'], mode: 'nav', section: 'BOM操作', label: '行を隠す / 戻す' },
  { id: 'sort.asc', keys: ['s'], mode: 'nav', section: 'BOM操作', label: '今の列で並び替え（昇順）' },
  { id: 'sort.desc', keys: ['Shift+S'], mode: 'nav', section: 'BOM操作', label: '今の列で並び替え（降順）' },
  { id: 'filter.byCell', keys: ['f'], mode: 'nav', section: 'BOM操作', label: '今のセルの値で絞り込み' },
  { id: 'columns.panel', keys: ['c'], mode: 'nav', section: 'BOM操作', label: '列の表示パネル' },

  // 5.5 チェック
  { id: 'issue.next', keys: ['n', 'F8'], mode: 'nav', section: 'チェック', label: '次の問題へ', hint: 'n 次の問題' },
  { id: 'issue.prev', keys: ['Shift+N', 'Shift+F8'], mode: 'nav', section: 'チェック', label: '前の問題へ' },
  { id: 'issue.quickfix', keys: ['Ctrl+.'], mode: 'nav', section: 'チェック', label: '今の問題をその場で直す' },
  { id: 'issue.ack', keys: ['x'], mode: 'nav', section: 'チェック', label: '警告を確認済みにする / 外す' },
  { id: 'issue.sequence', keys: ['Ctrl+Shift+F'], mode: 'any', section: 'チェック', label: '順番に直すモード' },
  { id: 'issue.defer', keys: ['Shift+ArrowRight'], mode: 'nav', section: 'チェック', label: '今の問題をあとで直す（次へ）' },

  // v0.2 流れ（flow-design §14）
  { id: 'publish', keys: ['Ctrl+Enter'], mode: 'nav', section: '流れ', label: '公開（自分の未公開の行＋下書き指摘）', hint: 'Ctrl+Enter 公開' },
  { id: 'issue.raise', keys: ['Shift+I'], mode: 'nav', section: '流れ', label: '指摘を起票（種別は頭文字）', hint: 'Shift+I 指摘' },
  { id: 'issue.reply', keys: ['Shift+R'], mode: 'nav', section: '流れ', label: '指摘に返信' },
  { id: 'issue.bounce', keys: ['Shift+X'], mode: 'nav', section: '流れ', label: '指摘を差戻し（専用）' },
  { id: 'adopt.cheapest', keys: ['Ctrl+Alt+A'], mode: 'nav', section: 'BOM操作', label: '最安で採用（スコア無視）。見積中なら先行採用' },
  { id: 'weights.row', keys: ['w'], mode: 'nav', section: 'BOM操作', label: 'この行だけ重みを変える' },
]

/** KeyboardEvent を "Ctrl+Shift+Z" 形式に正規化する。
 *  英字は e.code（物理キー）から決めるので、CapsLock・日本語配列・Shift の有無で揺れない。
 *  例: a → "a"、Shift+a → "Shift+A"、Ctrl+Shift+c → "Ctrl+Shift+C"、Shift+/ → "?" */
export function eventToKey(e: Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>): string {
  const mods: string[] = []
  const ctrl = e.ctrlKey || e.metaKey
  if (ctrl) mods.push('Ctrl')
  if (e.altKey) mods.push('Alt')
  const letter = /^Key([A-Z])$/.exec(e.code ?? '')?.[1] ?? (/^[a-zA-Z]$/.test(e.key) ? e.key.toUpperCase() : null)
  if (letter) {
    if (e.shiftKey) mods.push('Shift')
    const k = ctrl || e.altKey || e.shiftKey ? letter : letter.toLowerCase()
    return [...mods, k].join('+')
  }
  let key = e.key
  if (key === 'Spacebar') key = ' '
  if (key === 'Del') key = 'Delete'
  if (key === 'Esc') key = 'Escape'
  // 数字キーは e.code から（Ctrl+Shift+数字 などで key が記号になる環境向け）
  const digit = /^Digit(\d)$/.exec(e.code ?? '')?.[1]
  if (digit && (ctrl || e.altKey)) key = digit
  const printable = key.length === 1
  if (e.shiftKey && !printable) mods.push('Shift')
  if (printable && e.shiftKey && (ctrl || e.altKey) && key === '.') mods.push('Shift')
  return [...mods, key].join('+')
}

/** キー表記（'Shift+Y' / 'Ctrl+Enter' / 'Space'）からキー入力を作る。ヒントのクリックをキー操作と同じにするため */
export function keyToEventInit(k: string): KeyboardEventInit {
  const parts = k.split('+')
  const base = parts.pop() || '+'
  const init: KeyboardEventInit = { bubbles: true, cancelable: true, ctrlKey: parts.includes('Ctrl'), altKey: parts.includes('Alt'), shiftKey: parts.includes('Shift') }
  if (base === 'Space' || base === ' ') return { ...init, key: ' ', code: 'Space' }
  if (/^[a-zA-Z]$/.test(base)) return { ...init, key: init.shiftKey ? base.toUpperCase() : base.toLowerCase(), code: `Key${base.toUpperCase()}` }
  if (/^\d$/.test(base)) return { ...init, key: base, code: `Digit${base}` }
  return { ...init, key: base }
}

const byKey = new Map<string, KeyBinding[]>()
for (const b of KEYMAP) for (const k of b.keys) byKey.set(k, [...(byKey.get(k) ?? []), b])

/** モードに応じたバインディングを探す */
export function lookupBinding(key: string, mode: Mode): KeyBinding | undefined {
  const list = byKey.get(key)
  if (!list) return undefined
  return list.find((b) => b.mode === 'any' || (b.mode === 'nav' && mode === 'nav') || (b.mode === 'edit' && mode === 'edit'))
}

export function bindingsFor(id: string): string[] {
  return KEYMAP.find((b) => b.id === id)?.keys ?? []
}

export function formatKey(k: string): string {
  return k === ' ' ? 'Space' : k.replace('ArrowUp', '↑').replace('ArrowDown', '↓').replace('ArrowLeft', '←').replace('ArrowRight', '→').replace('Escape', 'Esc')
}
