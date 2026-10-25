# 利用者テスト ラウンド18 — ベテラン 100 人（キーボードだけで速く打つ・パレットを名前で叩く・300〜2,500 行を扱う・2 タブで使う・壊れたファイルを読ませる層）

（書きかけ。再実行の残りを流している間に、分かったものから書いている）

- 実施日：2026-10-25
- 対象：BOM Pro。`src/` は HEAD（`783edde`。ラウンド17 の修正 `12dfa4e`・`f1e8439` を含む）。`src/` は変更していない（報告とスクリプト・結果だけをコミット）
- 比較（A/B）：ラウンド17 で測ったビルド `7236090`（以下「r17 ビルド」）
- 開発サーバー：自分で `npx vite --port 5176 --strictPort` を立てて使った。作業領域（scratchpad）に `783edde` を `git archive` で取り出して `vite build` し（`7236090` はラウンド17 で作ったものをそのまま）、`vite preview` で 5197（現行）・5198（r17 ビルド）に出した
- 方法：Playwright（Chromium `/opt/pw-browsers/chromium`）。r17 の `lib17.mjs` を出力先だけ変えた `lib18.mjs`（→ r12 → … → r6）。各シナリオの前に storage を clear。console error / pageerror / dialog を全件収集
- 取り込みの判断は 2 経路で確かめた：`vite-node` で `src/io/paste.ts` の `parseBomPaste`（.xlsx は `xlsxToTsv` → `parseBomPaste`）を現行と r17 ビルドの両方で直接呼ぶ（`128-header-probe.ts`・`132b-big18-direct.ts`。r17 ビルドは scratchpad の `7236090/src` をその `vite.config.ts` で読む `probe.sh`）／同じ形を .xlsx・.csv・.tsv にしてガイド「2 ファイル」で 2 ビルドに取り込む（`128-header-wizard.mjs`・`132-big18.mjs`）。.csv / タブ区切りの文字はガイド「1 貼り付け」でも。2 経路の不一致 0（`128` の 57 形 × 2 ビルド、`132` の 7 ファイル × 2 ビルド）
- 2 回再現したものだけを不具合に数えた（取り込みは上の 2 経路、画面の操作は同じスクリプトを 2 回（`-run1`・`-run2`））
- スクリプト・結果：`usertest/veteran/r18/`

---

## 2. 新しい不具合（書きかけ）

形式：重大度 / 再現 / 期待 / 実際 / 証跡 / 推定原因（file:line）。取り込みの不具合は直接呼んだ結果（`128-header-probe.json`・`132b-big18-direct.json`）とガイドの .xlsx・.csv・.tsv（`128-header-wizard.json`・`132-big18.json`）が全形で一致（2 経路で再現）。「r17 ビルド」は 5198 と、その `src` を直接呼んだ `-r17b.json`。

（下書き。§2 の本文は最後にまとめる）
