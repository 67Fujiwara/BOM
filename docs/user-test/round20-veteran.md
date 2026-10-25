# 利用者テスト ラウンド20 — ベテラン 100 人（キーボードだけで速く打つ・パレットを名前で叩く・300〜2,500 行を扱う・2 タブで使う・壊れたファイルを読ませる層）

- 実施日：2026-10-25
- 対象：BOM Pro。`src/` は HEAD（`688ceb6`。ラウンド19 の修正を含む。`docs/user-test/round19-fixes.md`）。`src/` は変更していない（報告とスクリプト・結果だけをコミット）
- 比較（A/B）：ラウンド19 で測ったビルド `5bb9df8`（以下「r19 ビルド」）
- 開発サーバー：自分で `npx vite --port 5176 --strictPort` を立てた（現行）。作業領域（scratchpad）に `5bb9df8`（r19 ビルド）・`688ceb6`（現行の本番ビルド）を `git archive` → `vite build` → `vite preview` で 5198（r19 ビルド）・5197（現行の本番ビルド）に出した。終わったあと立てた 3 つは自分の PID だけ停止（`server-pids.txt`）
- 方法：Playwright（Chromium `/opt/pw-browsers/chromium`）。r19 の `lib19.mjs` を出力先だけ変えた `lib20.mjs`（→ r12 → … → r6）。各シナリオの前に storage を clear。console error / pageerror / dialog を全件収集
- 取り込みの判断は 2 経路で確かめた：`vite-node` で `src/io/paste.ts` の `parseBomPaste`（.xlsx は `xlsxToTsv` → `parseBomPaste`）を現行と r19 ビルドの両方で直接呼ぶ（`*-header-probe.ts`、r19 ビルドは scratchpad の `5bb9df8/src` をその `vite.config.ts` で読む `probe.sh`）／同じ形を .xlsx・.csv・.tsv にしてガイド「2 ファイル」で 2 ビルドに取り込む（`*-header-wizard.mjs`）。**2 経路の不一致 0**（`150` の 75 形・`156` の 19 形・`166` の 8 形・`177` の 4 形・`140` の 52 形、`cmp-wiz.mjs`。`140` の r19 の 53 形は 1 形が r19 の結果ファイルと名前が違うだけ）
- 2 回再現したものだけを不具合に数えた（取り込みは上の 2 経路、画面の操作は同じスクリプトを 2 回（`-run1`・`-run2`））
- **測定中の負荷**：前半は新人・中堅のテストが同じマシン（4 コア）で動いていて load average は 20〜45。後半は 3〜10。反応時間の A/B（§1）は総当たりが終わったあとの静かな時間に 2 ビルドを交互に測る
- スクリプト・結果：`usertest/veteran/r20/`
  - 新規（取り込み）：`150-shapes.mjs`・`150-header-probe.ts`・`150-header-wizard.mjs`（変更表の数え方 10・削除の語 4・〃 4・号機 6・DNP 5・数量 4・変更区分 6・半角カナ 4・→ 7・Altium 3・製作台数 8・縦の表題欄 2・単位 1・DNP 1・引用符 17）、`156-shapes.mjs` 系（括弧つきの削除の言い方・変更区分の値・変更内容と備考・〃の下の除外行）、`166-shapes.mjs` 系（DNP の語・Altium の 3 列・数量）、`177-shapes.mjs` 系（CSV のタブ）、`152-changesheet-truth.ts`（正解つきの変更表の乱数 3,000 通り×2 ビルド）、`150-ordinary-fuzz.ts`＋`150-ordinary-diff.mjs`＋`150-classify.mjs`＋`150-oracle.mjs`（普通の BOM の乱数）、`160-bigchange-direct.ts`（2,500 行の変更表）、`170-ordinary-big-make.mjs`＋`170-ordinary-big.mjs`（普通の 2,500 行の .xlsx・.csv・.tsv をガイドで）、`175-threshold-grid.ts`（書き写し×空の行の表）、`172-parse-garbage.ts`（乱数の文字列 6 万通り）、`155-parse-perf.ts`、`178*-redos*.ts`・`179-redos-wizard.mjs`・`180-redos-scan.ts`（正規表現の時間）、`165-xlsx-direct.ts`（取消線・数式・隠した列）、`176-delim-detect.ts`
  - 新規（画面）：`151-importdel-ui.mjs`・`151b-importdel-fixloop.mjs`・`158-importdel-undo.mjs`・`161-importdel-roles.mjs`・`163-importdel-bulk-paste.mjs`・`167-quickfix-keys.mjs`（【削除？】の直し方）、`157-ui-misc.mjs`・`181-needoffset-visible.mjs`（前倒しの警告）、`159-paste-trim.mjs`（セルの空白）、`164-case-row-keys.mjs`（7 の案件の行のキー）、`173-grid-paste-q.mjs`（表への貼り付けの引用符）、`162-storage-wizard.mjs`（ほぼ満杯の localStorage でガイド）、`174-flagged-latency.mjs`（【削除？】750 行の反応）、`141-excel-keys.mjs`＋`batchU.sh`（Ctrl+R・Ctrl+-・Ctrl+Shift+…）
  - 再実行：`sweep.sh`（r19 までの手順 約 100 本、現行 5176 のみ・2 回あるものは run1）→ `171-diff-r19.mjs`（r19 の同名の .log と突き合わせ）、`batchL.sh`（反応時間 A/B）、`batchP.sh`・`batchP2.sh`（直接呼び出し 20 本 × 2 ビルド）

---

## 1. 再確認（V19-01〜V19-19）

〔最終版で表を入れる〕

---

## 2. 新しい不具合

〔最終版で入れる〕
