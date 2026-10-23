# 利用者テスト ラウンド13 — ベテラン 100 人（キーボードだけで速く打つ・パレットを名前で叩く・300〜2,500 行を扱う・2 タブで使う・壊れたファイルを読ませる層）

- 実施日：2026-10-23
- 対象：BOM Pro。`src/` は HEAD（`ffb1d67`。ラウンド12 の修正 `20fe568`・`d521c2b`・`e99303e` を含む）。`src/` は変更していない・コミットしていない
- 比較（A/B）：ラウンド12 で測ったビルド `0608a5d`（以下「r12 ビルド」）
- 開発サーバー：自分で `npx vite --port 5176 --strictPort` を立てて使った。作業領域（scratchpad）に HEAD と `0608a5d` を `git archive` で取り出して `vite build` し、`vite preview` で 5197（現行）・5198（r12 ビルド）に出した。終わったあと立てた 3 つ（5176・5197・5198）は自分の PID だけ停止
- 方法：Playwright（Chromium `/opt/pw-browsers/chromium`）。各シナリオの前に `localStorage`・`sessionStorage` を clear し、`Storage.prototype.setItem` を無効にしてから再読み込み（r12 の `lib12.mjs` をそのまま使う `lib13.mjs`）。console error / pageerror / dialog を全件収集
- 打鍵：Playwright の実打鍵、ページ内で予定時刻にキーを発生させる方法（`typeSeqM`）、テンキー（NumLock あり）は CDP の `Input.dispatchKeyEvent`（`key: '4' code: 'Numpad4'`）、IME の確定文字は CDP の `Input.insertText`
- 取り込みの見出しの判断は、ブラウザ（ガイド「ファイルから」の .xlsx・「貼り付け」の欄）で確かめ、形を増やして調べるときは `vite-node` で `src/io/paste.ts` の `parseBomPaste` をそのまま呼んだ（`60-header-unit.ts`。ブラウザの結果と一致することを `61-header-wizard`・`66b-wizard-paste` で確認）
- スクリプト・結果：`usertest/veteran/r13/`（r12・r11 の手順は `r12-*.mjs`・`r11-*.mjs` として出力先だけ r13 に変えて流した）

__SECTIONS__
