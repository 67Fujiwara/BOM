# 利用者テスト ラウンド16 — ベテラン 100 人（キーボードだけで速く打つ・パレットを名前で叩く・300〜2,500 行を扱う・2 タブで使う・壊れたファイルを読ませる層）

- 実施日：2026-10-23
- 対象：BOM Pro。`src/` は HEAD（`bd8881e`。ラウンド15 の修正 `d2f4cfc`（ベテラン）・`47a4993`（新人）・`07e0647`（中堅）を含む）。`src/` は変更していない（報告とスクリプト・結果だけをコミット）
- 比較（A/B）：ラウンド15 で測ったビルド `b836657`（以下「r15 ビルド」）
- 開発サーバー：自分で `npx vite --port 5176 --strictPort` を立てて使った。作業領域（scratchpad）に `bd8881e` と `b836657` を `git archive` で取り出して `vite build` し、`vite preview` で 5197（現行）・5198（r15 ビルド）に出した。終わったあと立てた 3 つは自分の PID だけ停止
- 方法：Playwright（Chromium `/opt/pw-browsers/chromium`）。r15 の `lib15.mjs` を出力先だけ変えた `lib16.mjs`（→ r12 → … → r6）。各シナリオの前に storage を clear。console error / pageerror / dialog を全件収集
- 取り込みの判断は 2 経路で確かめた：`vite-node` で `src/io/paste.ts` の `parseBomPaste`（.xlsx は `xlsxToTsv` → `parseBomPaste`）を現行と r15 ビルドの両方で直接呼ぶ（`106-header-probe.ts`・`108b-xlsx-direct.ts`。r15 ビルドは scratchpad の `b836657/src` をその `vite.config.ts` で読む `probe.sh`）／同じ形を .xlsx・.csv にしてガイド「ファイルから」で 2 ビルドに取り込む（`107-header-wizard.mjs`・`108-xlsx-r16.mjs`）。さらに Excel から表をコピーした形はガイド「貼り付け」で 2 ビルドに（`109-wizard-paste-r16.mjs`）。`cmp-wizard.mjs` の突き合わせで 2 経路の不一致 0（`106`↔`107` 41 形 × 2 ビルド、`95`↔`96` は「"」の形 R5 だけ違う＝ .xlsx だけ直った、§1 V15-03）
- 2 回再現したものだけを不具合に数えた（取り込みは上の 2 経路、画面の操作は同じスクリプトを 2 回（`-run1`・`-run2`））
- 実行時の負荷：同じマシン（4 コア）で別の層の利用者テストが並行して動いており、前半（取り込み・Undo・JSON）は load average 15〜37。反応時間の A/B（`batchL.sh`）は §1 の表に測定時の負荷を書く
- スクリプト・結果：`usertest/veteran/r16/`
  - 再実行（r15 の新規手順、`batchT.sh`）：`96-header-wizard`・`97-xlsx-r15`・`104-header-wizard`・`105-redos-xlsx`（以上 2 ビルド）、`95-header-probe.ts`・`97b-xlsx-direct.ts`・`104-header-probe.ts`（2 ビルドの `src` を直接）、`98-f8-anchor`・`99-undo-publish3`・`100-json-r15`・`101-misc-r15`・`103-twotab-undo`（以上 × 2 回、一部は r15 ビルドでも）
  - 再実行（r14・r13・r12・r11 の手順、r15 と同じ一覧）：`batchS.sh`（r14 の新規手順）・`batchR.sh`（r13）・`batchA.sh`・`batchB.sh`（回帰の総当たり）・`batchL.sh`（反応時間 A/B、5197 / 5198）・`batchZ.sh`（入力ファイルの写し忘れで落ちた 2 本の流し直しと直接呼ぶ probe）。r15 の結果との突き合わせは `115-diff-r15.mjs`（→ `115-diff-r15.json`）・`difseg.mjs`
  - 新規：`106-shapes.mjs`・`106-header-probe.ts`・`107-header-wizard`（ラウンド15 の修正の境目 41 形 × 2 ビルド × 2 経路）、`108-xlsx-r16`・`108b-xlsx-direct.ts`（300 行の .xlsx・.csv 10 個 × 2 ビルド × 2 経路）、`109-wizard-paste-r16`（Excel からのコピー 300 行 6 形 × 2 ビルド）、`110-undo-publish4`（公開を戻す・飛ばす・別のタブの作業中 7 通り × 2 回＋r15 ビルド）、`111-mac-ctrl`・`114-mac-ctrl-typed`（macOS の Control+英字 12 キー × 4 か所、打っている途中 7 キー × 2 回＋Linux）、`112-json-r16`（JSON の文字の数・設定・日付 14 通り × 2 回＋r15 ビルド）、`113-dup-tab`（タブの複製と Ctrl+Z 3 通り × 2 回＋r15 ビルド）、`redos-probe.mjs`（区切りの判定の式を長いセルで）、`shots/`

---

（以下、§1〜§4 は結果がそろいしだい書く）
