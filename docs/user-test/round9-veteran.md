# 利用者テスト ラウンド9 — ベテラン 100 人（キーボードだけで速く打つ・パレットを名前で叩く・300〜2,500 行を扱う・2 タブで使う・壊れたファイルを読ませる層）

- 実施日：2026-10-23
- 対象：BOM Pro。`src/` は HEAD（`69d7208`。ラウンド8 の修正 `9e2eb23`・`968d93d`・`1c01130` を含む）。`src/` は変更していない・コミットしていない
- 開発サーバー：自分で `npx vite --port 5176 --strictPort` を立てて使った。ビルドは作業領域（scratchpad）に現行（HEAD）とラウンド8 時点（`484f359`）を `git archive` で取り出して `vite build` し、`vite preview` で 5195（現行）・5196（r8）に出した。終わったあと立てた 3 つ（5176・5195・5196）は自分の PID だけ停止
- 方法：Playwright（Chromium `/opt/pw-browsers/chromium`）。各シナリオの前に `localStorage`・`sessionStorage` を clear し、`Storage.prototype.setItem` を無効にしてから再読み込み（r8 の `lib8.mjs` をそのまま使う `lib9.mjs`）。console error / pageerror / dialog を全件収集
- 打鍵：Playwright の実打鍵、ページ内で予定時刻にキーを発生させる方法（`typeSeqM`、0 / 40ms 間隔）、macOS の Option・日本語配列（JIS）の記号キーは CDP の `Input.dispatchKeyEvent`（`key`・`code`・`text` 付き）
- 反応時間：5195（現行）と 5196（r8）を同じマシンで交互に 3 巡、中央値（ページ内で「キーを発生させてから次の描画まで」）。**ほかの利用者テストと同じ時間帯で、マシンの負荷（load average 3〜20、4 コア）が大きく揺れた**ので、比べるのは同じ回の A/B だけ。r8 の報告の数値とは直接比べない
- 注記（テスト手順）
  - r8 のスクリプトは `r8-*.mjs` として出力先・ポートだけ変えて流した。r8 の `12-f8flow` は「F8 を n 回押す」書き方で、今回は最初の F8 の行き先が変わった（→ V9-01）ため手順がずれる。同じ流れを「その行に来るまで F8」で書き直した `12-f8flow.mjs` で判定した（`r8-12-f8flow.log` は参考）
  - `r8-17-storage-restore` は 2 回目の確認が増えたため、2 回目を「やめる」「退避せずに戻す」の両方で選ぶ `17-storage-restore.mjs` に直した
  - `13-latency-ab` の最初の回（`13-latency-ab-partial.log`・`13-latency-ab-2500.log`）は、止めたつもりの前の回が裏で動き続けていて 2 本同時に測っていたので使わない。取り直した `13-latency-ab-2500b`・`13-latency-ab-300` を使う
- スクリプト・結果：`usertest/veteran/r9/`
  - 再実行（r8 の手順）：`r8-10-uneditable-digits`・`r8-10b-other-row`（書けない列で数字から）、`r8-11-alt-symbol-f1`（Alt＋記号・F1 × 7 場面 × 13 キー）、`r8-15-twotab`（2 タブ 9 通り）、`r8-20-malformed5`（重い正規表現・毎日の休日）、`r8-21-files5`（Excel 9 種）、`r8-23-norow-digits`、`78-paste`（300 / 1,000 / 2,500 行の貼り付け、A/B）
  - 新規：`12-f8flow`（F8 の流れ 25 通り）、`13-latency-ab`（反応時間 A/B）、`17-storage-restore`、`30-norow-symbols`（行を選んでいない 3 つの状態 × 17 語 × 2 速さ × 2 ビルド＝204 回）、`31-norow-keys`（行を選んでいない・書けない列で 41 キー × 3 役割）、`32-twotab2`・`40-twotab3`（2 タブ 14 通り）、`33-fix-leave`（直して 4 から外れた直後の Tab など 9 通り × 2 ビルド）、`34-files6`（新しい形の Excel 15 種）、`35-malformed6`（新しい形の JSON 13 通り）、`36-undo-chain`（12 操作の Undo / Redo を 2 速さ）、`37-mac-option-nav`（macOS の Option 文字を 1 文字目に、2 ビルド）、`38-misc-keys`（F1・Ctrl+F・JIS の Alt＋記号 13 通り）、`39-norow-insert`

---
