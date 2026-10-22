# BOM Pro — キーボード完結の BOM → 相見積 → 商社選定 → 正式見積

設計がBOMを作り、購買が相見積を取り、スコアの高い商社を選び、正式見積を依頼するまでを **同じ1つの表** の上で回すツールです。
購買の指摘で設計が直すコスト、設計・購買・PM の意思疎通による手戻りをゼロにすることを目標にしています。

- 仕様（キーボード）: `docs/keyboard-spec-v0.1.md` ＋ `docs/flow-design.md` §14 の差分（v0.2）
- 流れの設計: `docs/flow-design.md`（v4.1。購買・電気設計・PM の3者レビューを5ラウンド回して手戻り0・あいまい0で PASS）
- レビューの記録: `docs/review-loop/round1〜5-*.md`

## 動かす

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # dist/
npm test             # 単体テスト（vitest）
PW_CHROMIUM=/path/to/chrome npm run e2e   # キーボード操作の E2E（Playwright）
```

共有ストア（3者同時参照）を使うとき:

```bash
node sync/server.mjs 8787           # 追記型の JSON ストア
VITE_SYNC_URL=http://localhost:8787 npm run dev
```

無い場合はブラウザ単体（localStorage）で動き、`Ctrl+K → JSON を書き出す / 読み込む` で受け渡しできます。

## 最初の 2 分

| やること | キー |
| --- | --- |
| 迷ったら | `Ctrl+K`（名前で操作を探す。`R034 採用` のように文でも打てる） |
| ショートカット一覧 | `?` |
| ビュー切替 | `1`〜`9`（4 要確認 / 5 変更あり / 7 要決定 / 9 購買作業） |
| 次の問題へ | `n`、その場で直す `Ctrl+.`、確認済み `x` |
| 行を開く（相見積・スコア内訳・指摘・履歴） | `Space` |
| 採用 | `a` 推奨（最高スコア）/ `Shift+A` 選ぶ / `Alt+A` 最安 |
| 指摘を起票（購買） | `Shift+I` → 頭文字（k 型式あいまい / m メーカ未記入 / d 廃番 …）→ 本文 → `Enter` |
| 公開（提出・指摘の発行） | `Ctrl+Enter` |
| 要決定（PM） | `y` 承認 / `Shift+Y` 却下 / `Enter` 決定パネル |
| Excel 出力 / 書式つきコピー | `Ctrl+E` / `Ctrl+Shift+C` |
| 元に戻す | `Ctrl+Z`（自分の操作だけ） |

役割（設計 / 購買 / PM）はヘッダー右のボタンか `Ctrl+K → 役割を切り替え` で変えられます。役割外の列は書けません。

## 構成

```
src/keys/keymap.ts      キー定義表（1か所）。ヘルプ・パレット・ステータスバーはここから生成
src/model/              型・状態遷移（lifecycle）・スコア・チェックルール・ビュー・列・導出（ボール/期限）
src/actions/            行・公開 / 指摘 / 採用 / PM 決定・案件設定 / 見積依頼・取込
src/commands/registry   すべての操作とパレット、キー処理
src/ui/                 画面（ヘッダー・ビュー一覧・表・行の詳細・ステータスバー・パネル）
src/io/                 Excel（exceljs）・保存と共有ストア
sync/server.mjs         共有ストア
e2e/                    Playwright（キーボードだけで流れを通す）
```
