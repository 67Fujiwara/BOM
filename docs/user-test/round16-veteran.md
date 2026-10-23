# 利用者テスト ラウンド16 — ベテラン 100 人（キーボードだけで速く打つ・パレットを名前で叩く・300〜2,500 行を扱う・2 タブで使う・壊れたファイルを読ませる層）

- 実施日：2026-10-23
- 対象：BOM Pro。`src/` は HEAD（`bd8881e`。ラウンド15 の修正 `d2f4cfc`（ベテラン）・`47a4993`（新人）・`07e0647`（中堅）を含む）。`src/` は変更していない（報告とスクリプト・結果だけをコミット）
- 比較（A/B）：ラウンド15 で測ったビルド `b836657`（以下「r15 ビルド」）
- 開発サーバー：自分で `npx vite --port 5176 --strictPort` を立てて使った。作業領域（scratchpad）に `bd8881e` と `b836657` を `git archive` で取り出して `vite build` し、`vite preview` で 5197（現行）・5198（r15 ビルド）に出した。終わったあと立てた 3 つは自分の PID だけ停止
- 方法：Playwright（Chromium `/opt/pw-browsers/chromium`）。r15 の `lib15.mjs` を出力先だけ変えた `lib16.mjs`（→ r12 → … → r6）。各シナリオの前に storage を clear。console error / pageerror / dialog を全件収集
- （作業中。結果がそろいしだい書き足す）
