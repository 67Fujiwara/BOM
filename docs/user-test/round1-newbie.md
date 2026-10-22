# 利用者テスト ラウンド1 — 新人 100 人（入社 1〜2 年、BOM ツール・ショートカット未経験）

- 実施日：2026-10-22
- 対象：BOM Pro（`npm run dev`、http://localhost:5173、サンプル案件 P-2026-041 / 80 行）
- 方法：Playwright（Chromium）で新人 100 人分の行動を 15 本のシナリオスクリプトに分けて自動再現。各シナリオの前に `localStorage.clear()` → リロード。console エラー・pageerror を全件収集。
- スクリプト：`usertest/newbie/s01_mouse.mjs` 〜 `s16_evidence.mjs`（共通部品 `lib.mjs`）（`node usertest/newbie/xxx.mjs`）。ログ：`usertest/newbie/results/*.out|*.json`。スクリーンショット：`usertest/newbie/shots/*.png`
- 観点：迷う・壊れる・エラー・メッセージが不親切・画面が崩れる・データが消える・戻せない。「仕様上そうなっている」ものでも新人が詰まるものは「使い勝手」として分けて記載。
- 注記：画面下のトーストは 4 秒で消えるため、ログ中の `toast` は直前の操作のものでない場合がある。重要な判定は `clearToast` で消えるのを待ってから再確認した。

---

## 1. 実施した操作シナリオ

| # | 想定人数 | ペルソナ・行動 | スクリプト |
| --- | --- | --- | --- |
| S01 | 15 | マウス中心。サイドバーのビュー・セルをクリック、ダブルクリックで編集、編集中に別セルをクリック、役割ボタン・`Ctrl+K` ボタン・列ヘッダ・分類見出し・指摘をクリック、オーバーレイ外クリック | s01_mouse |
| S02 | 10 | `?` と `Ctrl+K` に頼る。パレットに 55 種の日本語/英語（保存・削除・戻る・終了・印刷・提出・ヘルプ・エクセル・R999 …）を打つ。`Ctrl+K` 2 回、該当なしで Enter、パレット内で `j4a`、受信箱で該当なし Enter | s02_palette |
| S03 | 12 | ナビモードで文字を打つ（z/h/s/f/c/o/i/x/n/w/r）、読み取り専用列で文字、数量セルで `5`、`十`、Esc 連打、Enter 連打、Backspace/Delete/Shift+Delete、編集中に `?`・`Ctrl+K`、Tab 30 回、↓100 回 | s03_navtyping |
| S04 | 12 | 順番・役割違い。行未選択で a/r/Shift+I/w/Ctrl+./y…、見積前・選定済の行に a/Shift+A/Alt+A、設計が Shift+I・y、エラーのまま Ctrl+Enter、購買が型式編集・行追加・削除・r・a、PM が型式編集・Shift+I・a・y | s04_order |
| S05 | 12 | 新規 BOM ガイドで雑な入力：全部空欄で Enter 連打、既存と同じ案件 ID、納期「来月」、工程日数「十」、予算「100万」、カンマ区切り/スペース区切り/ヘッダー付き/列順違い/Excel 風ヘッダー（品名・形式・員数）/数量「十」「0」の貼り付け、Esc で中止、商社選択で Space 連打、選択肢をクリック | s05_wizard, s05b_wizard |
| S06 | 8 | 行を開いて（Space）指摘を見て迷う。↓で指摘選択→Enter、間違ったキー、空の回答、Ctrl+.、Shift+R 空送信、Shift+X、詳細を複数開いて Esc、見積行まで↓、設計が 7 ビューで Enter | s06_detail |
| S07 | 6 | 絞り込み入力に打って Enter/Esc、`/` キー 2 回、入力中に `j4a1`/`?`/`Ctrl+K`/`Ctrl+Z`/`Ctrl+Enter`/Tab、全角検索、f の解除、0 件のまま Enter/Shift+Enter、s の解除 | s07_filter |
| S08 | 5 | 編集→リロード、役割→リロード、ブラウザ戻る、ダークモード→リロード、2 タブ同時編集、壊れた localStorage | s08_persist |
| S09 | 5 | 1024×700 / 1280×720 / 1920×1080 / 800×600 / ダークモードで表・詳細・ヘルプ・案件設定・ガイド・9 ビュー・右端列を確認、要素の画面外はみ出しを計測 | s09_layout |
| S10 | 5 | 役割ボタン連打、設計の未公開編集を購買で見る、`Ctrl+K → 役割を切り替え`、サンプルに戻す→Ctrl+Z、JSON 書き出し、JSON 読み込み（不正・空・配列・projects なし・不完全・正常）、案件を増やして切替、案件をまたいだ Ctrl+Z | s10_data, s10b_data |
| S11 | 5 | 購買：9 ビュー、Shift+I で種別パネルの誤操作（1/Enter/↓/z/x/K）、本文空で起票、Ctrl+Z、本文入力後の J、代替不可の行に a、廃番+Tab で提案欄、Ctrl+Enter 発行、設計側で提案適用、概算見積を依頼（期限「来週」）、見積回答を取り込む（ゴミ貼り付け）、正式見積を依頼、x、下書きを残して役割切替 | s11_purchasing, s15_followup |
| S12 | 3 | PM：要決定でない行で y、7 ビューで Enter→決定パネル（z/y/b）、理由なし Enter、Ctrl+Z、Shift+Y、案件設定で納期「来月」→影響試算→理由、設計が案件設定で Enter/y、案件設定を確定 | s12_pm, s15_followup |
| S13 | 2 | その他：Ctrl+Enter の順序、必要数に 十/0/-1/1.5/１０/10個、h、Ctrl+S/E/Shift+C/G/Y、c、[ ]、PageUp/Down、Home/End、Ctrl+↑↓、Shift+D、Alt+↑、Ctrl+C/V、Ctrl+Shift+F、Shift+→、公開後の Ctrl+Z、Shift+A で範囲外、パレットで Tab、Ctrl+. 候補なし、編集中に役割/ビューをクリック | s13_misc, s14_extra, s15_followup |

合計 100 人。console エラーは全シナリオで `favicon.ico 404` が毎回出る（N-37）。それ以外のエラーは個別に記載。

---

## 2. 不具合

形式：重大度 / 再現手順（キー列）/ 期待 / 実際 / 証跡 / 推定原因

### N-01 予算に「100万」など数値以外を入れると白画面（Header がクラッシュ）
- 重大度：**致命**
- 再現：`Ctrl+K` → `新しいBOM` → 案件ID `B-1` Enter → 案件名 Enter → 納期 Enter → 工程日数 Enter → 予算 `100万` Enter → Enter → Enter → 貼り付け欄に 1 行 → `Ctrl+Enter` → Enter
- 期待：数値以外は受け付けない（または空扱い）で案件が作られる
- 実際：画面全体が真っ白になり何も操作できない。pageerror `Cannot read properties of null (reading 'toFixed')`、`An error occurred in the <Header> component`。リロードすると復旧する（NaN が JSON で null になるため）が、新人はリロードで直るとは分からない
- 証跡：`usertest/newbie/shots/s15_budget_crash.png`（白画面）、`usertest/newbie/results/s15_followup.out`、`s13_misc.out`、`s14_extra.out`（同じ例外）
- 推定原因：`src/commands/registry.ts:391` `budget: d.budget ? Number(d.budget) : null` が NaN を通す。`src/ui/Header.tsx:19` は `t.budget ? … : null` で NaN のとき `pct=null`、同 `:34` は `t.budget != null` で NaN を通して `pct!.toFixed(1)` を呼ぶ。アプリに ErrorBoundary が無い

### N-02 JSON 読み込みで不完全なデータを入れると白画面になり、リロードしても戻らない
- 重大度：**致命**
- 再現：`Ctrl+K` → `JSON を読み込む` → `{"projects":[{"id":"x","name":"壊れた"}],"currentProjectId":"x"}` を貼る → `Ctrl+Enter`
- 期待：形式チェックで拒否（「読み込めません」）
- 実際：pageerror `p.rows is not iterable` で白画面。壊れたワークスペースが localStorage に保存されるため **リロードしても白画面のまま**。復旧は DevTools で localStorage を消すしかない（新人には不可能）
- 証跡：`usertest/newbie/shots/s10b_import_crash_partial.png`、`s08_broken_storage.png`、`results/s10b_data.out`（`after reload grid? 0`）、`results/s08_persist.out`
- 推定原因：`src/commands/registry.ts:757-765` は `ws.projects` の有無しか見ない。`src/io/persist.ts:loadWorkspace` も `projects.length && user` のみ。ErrorBoundary 無し

### N-03 1024 / 1280 幅でヘッダー右端（役割ボタン・`Ctrl+K コマンド` ボタン）が画面外に出てクリックできない
- 重大度：**重大**（マウス中心の新人は役割切替・パレットに到達できない）
- 再現：ウィンドウ 1024×700（または 1280×720）で開く
- 期待：ヘッダーが折り返すか要約され、ボタンが見える
- 実際：`.header` の scrollWidth 1564 > 1024。役割ボタン left=1256、Ctrl+K ボタン left=1435 で画面外（1280 でも left=1321/1497）。ランプ（エラー・警告）も切れる
- 証跡：`usertest/newbie/shots/s09_1024x700-light_grid.png`、`s09_1280x720-light_grid.png`、`results/s09_layout.out`（`clipped` 計測）
- 推定原因：`src/styles/app.css:38-39` `.header { white-space: nowrap; overflow: hidden }` と `.header > * { flex-shrink: 0 }`

### N-04 1024 幅でヘッダー内のボタンにフォーカスが移るとヘッダー全体が横スクロールし、案件名・納期が消える
- 重大度：**重大**
- 再現：1024×700 で役割ボタンをクリック（Playwright は scrollIntoView するので画面外でも押せる。実ユーザーは Tab フォーカス等）→ ヘッダーの先頭要素が left=-526 まで流れる
- 期待：ヘッダーは固定
- 実際：案件 ID・案件名・納期が左に消えたまま戻らない
- 証跡：`usertest/newbie/shots/s09_1024x700-light_toast.png`、`results/s09_layout.out`（`"pid" right:-466`）
- 推定原因：N-03 と同じ（overflow:hidden のコンテナが focus/scrollIntoView で scrollLeft を持つ）

### N-05 行を選んでいない状態で操作キーを押すと、黙って先頭行 R001 に適用される（`r` は置換行まで作る）
- 重大度：**重大**（意図しない採用・置換がトースト 1 行だけで起きる）
- 再現：開いた直後（カーソル「—」）または Esc 連打後に `a` / `Alt+A` / `r` / `Shift+I` / `w` / `Ctrl+.`
- 期待：「行を選んでください」で止まる（`need()` の想定）
- 実際：`a` → 「R001 を 因幡電機 で採用」、`Alt+A` → R001 を最安で採用、`r` → **R081 の置換行が作られ R001 が置換済に**、`Shift+I`/`w`/`Ctrl+.` → R001 のパネルが開く
- 証跡：`results/s04_order.out` 冒頭 13 行、`results/s03_navtyping.out`（`a after Esc spam`）、`results/s01_mouse.out`（分類見出しで a）
- 推定原因：`src/commands/registry.ts:1160`（`handleKeyDown` が move 系以外で `ensureCursor()` を先に呼び、`runCommand` 内の `need()` が常に行ありになる）

### N-06 新規 BOM ガイド「部品の入れ方」で `1`/`2`/`3` と Enter が効かず、フッター「Enter 次へ」と食い違う。数字が貼り付け欄に入り、そのまま行になる
- 重大度：**重大**（12 人中ほぼ全員がここで止まる）
- 再現：`Ctrl+K` → `新しいBOM` → Enter ×7 → `3`（1つずつ入力のつもり）→ Enter → Enter
- 期待：`3` で「1つずつ入力」が選ばれ、Enter で次へ
- 実際：textarea に自動フォーカスされているため `3` と改行が貼り付け欄に入る（選択は「1 貼り付け」のまま）。`Ctrl+Enter` で進むと分類「3」という行が作られる（`A stored: … rows=3:`）。Enter 連打では永久に先へ進めない
- 証跡：`usertest/newbie/shots/s05b_step7_stuck.png`、`results/s05b_wizard.out`、`results/s05_wizard.out`
- 推定原因：`src/commands/registry.ts:1100-1105`（`panel.step === 7 && /^[1-3]$/ && !(target instanceof HTMLTextAreaElement)`、Enter は textarea 中は無視）と `src/ui/Panels.tsx` Wizard step 7 の `AutoInput multiline`（autofocus）。フッターは「Enter 次へ」固定

### N-07 既存と同じ案件 ID で新規 BOM を作れる。新しい案件を開けず、React のキー重複エラー
- 重大度：**重大**
- 再現：`新しいBOM` → 案件ID `P-2026-041`（サンプルと同じ）→ 残りを Enter → 作成
- 期待：重複 ID を拒否、または ID を自動採番
- 実際：サイドバー・受信箱には 2 件並ぶが、どちらを選んでも先頭（サンプル）が開く。新案件は到達不能。console に `Encountered two children with the same key, P-2026-041` ×7
- 証跡：`results/s05b_wizard.out`（`B stored: ["P-2026-041/第3ライン…","P-2026-041/テスト盤2…"]`）、`shots/s05b_due_raigetsu.png`
- 推定原因：`src/commands/registry.ts:389-408`（重複チェック無し）、`src/model/store.ts:project()` が `find` で先頭を返す

### N-08 設計の未公開（作業中）の値が購買・PM にそのまま表示される
- 重大度：**重大**（flow-design §5「購買には『設計作業中 ●』だけ見える」に反する。購買が未公開の型式で見積を取りかねない）
- 再現：設計で R030 型式を `NEW-MODEL` に編集（未公開）→ 役割ボタン「購買」
- 期待：購買の型式セルは公開済の値＋作業中マーク
- 実際：購買の表に `NEW-MODEL` が黄色背景で表示される（状態セルに「作業中●」は付く）
- 証跡：`usertest/newbie/shots/s10_working_as_purchasing.png`、`results/s10_data.out`
- 推定原因：`src/model/selectors.ts:cellText` が役割に関係なく `effective(row)`（`src/model/derive.ts:5-8`）を表示に使う

### N-09 2 タブ（2 ウィンドウ）で同時に開くと、後から操作した側が全体を上書きし、もう一方の編集が消える
- 重大度：**重大**（データ消失。共有サーバ無しの運用では起こりやすい）
- 再現：タブ A・B で開く → B で R031 を編集 → A で R032 を編集 → B をリロード
- 期待：両方残る、または競合を知らせる
- 実際：R031 の編集が消える（`2 tabs: R031 表示灯 赤`）
- 証跡：`results/s08_persist.out`
- 推定原因：`src/io/persist.ts:saveWorkspace` がワークスペース全体を上書き、`storage` イベント監視無し（`startSync` は VITE_SYNC_URL がある時だけ）

### N-10 納期に「来月」など日付以外を入れると受理され、ヘッダーが「納期 あとNaN日」、必要日が「aN/NaN」になる
- 重大度：**中**
- 再現：ガイドの納期に `来月`（ヒントは「YYYY-MM-DD または 未定」）→ 作成。または PM で `案件設定` → 案件納期 `来月` → Ctrl+Enter → 理由 → 1
- 期待：日付でなければ拒否するか未定扱い
- 実際：ヘッダー `納期 あとNaN日（必要日 あとNaN日）`、必要日列 `aN/NaN`、影響試算は普通に通る。公開もできる
- 証跡：`shots/s15_due_raigetsu_header.png`、`shots/s15_settings_raigetsu.png`、`results/s15_followup.out`
- 推定原因：`src/commands/registry.ts:391`（`dueDate: d.due !== '未定' ? d.due : null`）、`registry.ts:323`（saveSettings の dueDate）、`src/model/dates.ts:19 diffDays` が NaN を返す

### N-11 `Ctrl+Enter`（公開）がエラーで通らない場合でも、先に「公開の Rev」「変更セットの理由」を聞いてから拒否する
- 重大度：**中**
- 再現：設計で `Shift+Enter` → 部品名だけ入れて Enter → Esc → `Ctrl+Enter` → `1`
- 期待：先に「公開できません: エラー …」
- 実際：「公開の Rev」（1 新しい Rev / 2 直前の Rev に追記）を答えさせた後に「公開できません: エラー 2 件（R081 型式が空です …）」
- 証跡：`shots/s14_publish_prompt_then_error.png`、`shots/s14_publish_blocked.png`、`results/s14_extra.out`
- 推定原因：`src/commands/registry.ts:272-291 publishFlow` がゲート判定（`src/actions/rows.ts:277-290`）の前にプロンプトを出す

### N-12 公開後の `Ctrl+Z` が Rev ごと消す（仕様：Rev を消さず逆向きの作業中変更として積む）
- 重大度：**中**
- 再現：R030 型式を編集 → `Ctrl+Enter` → 理由 `1` → `Ctrl+Z`
- 期待：ステータスバー「公開済の値を戻します（未公開として積む）」、Rev は残る
- 実際：「元に戻す: 公開」で `提出 Rev.3` が `Rev.1` に戻り、6 行が未公開に戻る。購買が見た Rev が消える
- 証跡：`shots/s14_undo_after_publish.png`、`results/s14_extra.out`
- 推定原因：`src/model/store.ts:commit/undoLast` の UndoEntry が `project.submissions` ごとスナップショットし、`rows.publish` に特別扱いが無い

### N-13 `Ctrl+K → 役割を切り替え（ログイン）` に氏名欄が出ない
- 重大度：**中**
- 再現：`Ctrl+K` → `役割` → Enter
- 期待：プレースホルダ「氏名（空なら案件の担当者名）」のとおり氏名を入れられる
- 実際：1 設計 / 2 購買 / 3 PM の選択肢だけで入力欄が無い（コードは `text` を氏名として使う前提）
- 証跡：`results/s10b_data.out`（`role prompt has text input: 0`）、`results/s10_data.out`（fill がタイムアウト）
- 推定原因：`src/ui/Panels.tsx:218`（`panel.requireText || !panel.options` のときだけ入力欄）、`src/commands/registry.ts:769-774`

### N-14 指摘の本文が空でも Enter で起票・発行できる
- 重大度：**中**
- 再現：購買で `Shift+I` → `k` → Enter
- 期待：「本文は必須です」
- 実際：`I-006 型式あいまい を下書きに追加`。本文空のまま `Ctrl+Enter` で発行される。さらにカーソルが部品名列だったので `[name]` セルに付く（型式あいまいなのに）
- 証跡：`shots/s11_empty_issue.png`、`results/s11_purchasing.out`
- 推定原因：`src/commands/registry.ts:933-940`（text の空チェック無し）、`src/actions/issues.ts:26 raiseIssue`

### N-15 指摘起票の提案欄で Tab が次の欄に移らず、型式欄に留まる
- 重大度：**中**
- 再現：`Shift+I` → `d` → 本文 → Tab → `NEW-123` → Tab → `オムロン` → Enter
- 期待：2 回目の Tab でメーカ欄へ
- 実際：Tab が常に `step: 'proposal'` の再設定＋preventDefault になり、メーカが型式に連結して `提案: NEW-123オムロン /` になる
- 証跡：`shots/s11_proposal.png`、`results/s11_purchasing.out`
- 推定原因：`src/commands/registry.ts:929-933`

### N-16 PM が要決定でない行で `y` を押すと理由を聞かれ、入力後に「この行（なし）では承認は選べません」
- 重大度：**中**
- 再現：PM で `1` ビュー → R020 → `y` → 理由 → Enter
- 期待：押した時点で「この行は要決定ではありません」
- 実際：「決定: 承認（理由）」プロンプト → 入力後に拒否
- 証跡：`results/s12_pm.out`
- 推定原因：`src/commands/registry.ts:671-672`（`pmOptions(pmCaseOf)` が空でも既定 `'承認'` でプロンプト）、判定は `src/actions/pm.ts:84` の commit 内

### N-17 購買の未発行（下書き）指摘が設計の行詳細に見える
- 重大度：**中**（下書きは発行前の購買の作業。設計には見えないはず）
- 再現：購買で `Shift+I` → `q` → 本文 → Enter（発行しない）→ 役割「設計」→ R040 → Space
- 実際：`I-006 質問 下書き …` が設計の指摘一覧に出る（4 要確認には出ない）
- 証跡：`results/s15_followup.out`
- 推定原因：`src/ui/Detail.tsx:17`（rowId だけで filter）

### N-18 「サンプルデータに戻す」後も古い Undo スタックが残り、`Ctrl+Z` でリセット前の行データが戻る
- 重大度：**中**
- 再現：R030 を編集 → `Ctrl+K` → `サンプル` → Enter（戻す）→ `Ctrl+Z`
- 実際：「元に戻す: セル編集」とリセット前の R030 のスナップショットが新しいサンプルに上書きされる
- 証跡：`results/s10b_data.out`、`shots/s10b_after_reset.png`
- 推定原因：`src/commands/registry.ts:745-752 data.reset` が `undo/redo` を消さない。`src/model/store.ts:applyEntry` が行ごとに復元

### N-19 貼り付け取り込みで数量「0」「十」「１０」が黙って 1 になる
- 重大度：**中**
- 再現：ガイドの貼り付けに `制御\tリレー\tMY4N\tオムロン\t十\t個\tKA1` と `…\t0\t…`
- 実際：どちらも必要数 1（エラー 0 件で検査を通る）
- 証跡：`results/s05b_wizard.out`（`C[qtyText]`）
- 推定原因：`src/commands/registry.ts:402` `Number(g(ci.qty)) || 1`

### N-20 必要数セルに全角「１０」「10個」を入れると値が捨てられ空になる（メッセージ無し）
- 重大度：**中**（日本語 IME で全角数字はよく起きる）
- 再現：R077 必要数 → Enter → `１０` → Enter
- 実際：セルが空（エラー表示「必要数が0以下です」だけ）、トースト無し。`十` も同じ
- 証跡：`results/s13_misc.out`
- 推定原因：`src/actions/rows.ts:parseValue` num（`Number()` が NaN → null）。全角→半角の正規化が無い

### N-21 絞り込みで 0 件でもカーソルが隠れた行に残り、Enter で見えない行の編集モードに入る
- 重大度：**中**
- 再現：絞り込みに `zzzz` → Enter（0 件）→ Enter
- 実際：モード「編集」になるが画面には入力欄が無い。`Shift+Enter` も効かない
- 証跡：`results/s07_filter.out`（`Enter with 0 rows: mode 編集`）、`shots/s07_insert_in_filtered.png`
- 推定原因：`src/commands/registry.ts:69-74 ensureCursor`（items が空なら何もしない）、`startEdit` に可視チェックが無い

### N-22 絞り込み入力にフォーカスがあると `Ctrl+K` `?` `Ctrl+Z` `Ctrl+Enter` が効かない
- 重大度：**中**（「迷ったら Ctrl+K」が使えない場面がある）
- 再現：`/` → `Ctrl+K`
- 実際：何も起きない。`?` は文字として入る
- 証跡：`results/s07_filter.out`
- 推定原因：`src/commands/registry.ts:1134-1142`（filter 入力中は Esc/Enter 以外を全部無視）

### N-23 受信箱（`Ctrl+P`）で検索して該当なしのまま Enter を押すと「新しいBOM」ガイドが開く
- 重大度：**中**
- 再現：`Ctrl+P` → `存在しない` → Enter
- 実際：新規 BOM ガイドが開く（案件を探していた新人が混乱）
- 証跡：`results/s02_palette.out`（`inbox Enter on no match: panel panel-wizard`）
- 推定原因：`src/commands/registry.ts:1035-1038`（`index >= list.length` で project.new。0 件なら常に真）

### N-24 新規 BOM ガイドのフッターは「Esc 中止」だが、2 段階目以降の Esc は 1 つ前に戻るだけ
- 重大度：**中**
- 再現：ガイド → Enter ×3 → Esc
- 実際：「社内工程日数」→「納期」に戻る。中止には段階数ぶん Esc が要る（最大 9 回）
- 証跡：`results/s05b_wizard.out`（`D Esc at step3 -> step 納期`）
- 推定原因：`src/commands/registry.ts:879-880`、`src/ui/Panels.tsx` Wizard の Foot

### N-25 編集中に別のセル・ビュー・役割ボタンをクリックすると、編集が続いたままフォーカスだけ外れ、打った文字が消える
- 重大度：**中**
- 再現：部品名をダブルクリック → 別セルをクリック → `abc` と打つ → Enter
- 実際：クリックは無視（カーソル移動しない）、`abc` はどこにも入らず、Enter で元の値のまま確定。役割ボタンをクリックした場合は役割が購買に変わったまま編集モードが残り、Enter で「権限なし（設計の列）」となって入力が消える
- 証跡：`shots/s01_edit_focus_lost.png`、`shots/s14_role_click_during_edit.png`、`results/s01_mouse.out`
- 推定原因：`src/ui/Grid.tsx:116-119`（編集中の onClick を無視）、input の blur を扱っていない

### N-26 ナビモードの Backspace / Delete でセルが黙って空になる
- 重大度：**中**（「戻る」のつもりの新人が型式を消す。トースト無し）
- 再現：R011 型式 → Backspace
- 実際：型式が空（作業中変更として積まれる）。メッセージ無し。Ctrl+Z で戻る
- 証跡：`shots/s03_backspace.png`、`results/s03_navtyping.out`
- 推定原因：`src/keys/keymap.ts:60`（Backspace を cell.clear に割当）、`src/actions/rows.ts:110 clearCell`（トースト無し）

### N-27 `h`（隠す）・`Shift+Delete`（提出済の行の取消）・`r`（置換）が 1 キーで即実行され、メッセージが出ない
- 重大度：**中**
- 再現：R011 → `Shift+Delete`（状態が「取消」になるが無通知）、R077 → `h`（薄くなるだけ）、R003 → `r`（R081 ができ編集に入る）
- 証跡：`results/s03_navtyping.out`、`results/s13_misc.out`（`h: toast null`）
- 推定原因：`src/actions/rows.ts:148-182`（deleteRow / toggleHidden にトースト無し）

### N-28 貼り付けのヘッダー行検出が「部品名|型式」のみ。Excel でよくある「品名・形式・メーカー・員数」はヘッダーが行として取り込まれ、列もずれるのにエラー 0
- 重大度：**中**
- 再現：ガイドの貼り付けに `No.\t品名\t形式\tメーカー\t員数\n1\tリレー\tMY4N-D2 DC24\tオムロン\t4`
- 実際：`R001 分類=No. 部品名=品名 型式=形式 …`、`R002 分類=1 部品名=リレー 型式=MY4N…`（1 列ずれ）。カンマ区切りは 1 列目に丸ごと入る。分類無しの貼り付けも 1 列ずれる
- 証跡：`results/s05b_wizard.out`（`C[excelHeaderJp]`、`C[comma]`、`C[noCategory]`）、`shots/s05b_paste_*.png`
- 推定原因：`src/commands/registry.ts:395-398`

### N-29 行を開く（Space）と詳細が画面の下に隠れて見えないことがある
- 重大度：**中**（新人は「Space が効かない」と思う）
- 再現：1024×700 で画面下寄りの行（R022）→ Space
- 実際：行はハイライトされるが詳細はスクロール外。↓で行を進めると見える
- 証跡：`shots/s09_1024x700-light_detail.png`
- 推定原因：`src/ui/Grid.tsx:16-18`（cursor セルだけ scrollIntoView）

### N-30 行詳細の相見積テーブルで商社名が 1 文字ずつ縦に折り返され、行が極端に高くなる（1440 幅でも）
- 重大度：**中**
- 再現：R016 → Space
- 実際：「因幡電機」が 4 行に縦書き、各商社行の高さ 150px 以上
- 証跡：`shots/s06_detail_open.png`、`shots/s01_issue_click_enter.png`
- 推定原因：`src/styles/app.css` `.detail-grid { grid-template-columns: 1fr 1fr }` と `table.quotes { width: 100% }`（セルに nowrap が無い）

### N-31 設計が `Shift+I` で指摘を起票できる（役割チェック無し）
- 重大度：**中**（指摘は購買が起票する運用。設計が自分宛に起票し公開できてしまう）
- 再現：設計で `Shift+I` → `k` → 本文 → Enter（下書きができ、ステータスバー「指摘 1」。`Ctrl+Enter` の公開対象に含まれる）
- 証跡：`results/s04_order.out`（`design raised issue: I-006 …`）
- 推定原因：`src/actions/issues.ts:26 raiseIssue` / `canRaise` に role の判定が無い

### N-32 `a` を下書き行に押すと「選定済以降の行は採用できません」と逆の説明になる
- 重大度：**軽微**
- 再現：R076（下書き）→ `a`
- 証跡：`results/s04_order.out`
- 推定原因：`src/actions/adopt.ts:26`（`status === 'submitted' ? '見積前' : '選定済以降'`。draft が後者に落ちる）

### N-33 ダブルクリックは権限外の列・自動計算列でも編集モードに入り、確定時にはじめて「権限なし」「この列は自動計算です」
- 重大度：**軽微**
- 再現：購買で型式をダブルクリック、または金額/スコア列をダブルクリック
- 証跡：`results/s01_mouse.out`
- 推定原因：`src/ui/Grid.tsx:120`（onDoubleClick が `canEdit` を見ない）

### N-34 役割ボタンをクリックした後もフォーカスがボタンに残り、Space/Enter で役割が再コミットされつつ表の操作も走る
- 重大度：**軽微**
- 再現：「購買」クリック → Space → Enter
- 実際：「役割: 購買」のトーストが繰り返し出る＋行が開く／編集が走る
- 証跡：`results/s01_mouse.out`
- 推定原因：`src/ui/Header.tsx:47`（クリック後に blur しない）

### N-35 `Ctrl+Shift+C` / `Ctrl+Shift+F` が `e.key` が小文字で来る環境（CapsLock・一部 IME 状態）では別の操作になる
- 重大度：**軽微**
- 再現：`e.key='c'` + Shift + Ctrl → セルのコピー（書式つきコピーではない）。`e.key='f'` → 無反応
- 証跡：`results/s15_followup.out`（`Ctrl+Shift+c: keys ["c+S+C"] toast コピー: リレー`）
- 推定原因：`src/keys/keymap.ts:113-116 eventToKey`（Shift の付与を `/[A-Z]/` に依存）

### N-36 `Ctrl+.` の候補が無いとき Enter を押してもパネルが閉じない。指摘種別パネルで Enter/↓/数字が無反応
- 重大度：**軽微**
- 証跡：`results/s14_extra.out`、`results/s11_purchasing.out`
- 推定原因：`src/commands/registry.ts` quickfix/issue の `return true` 固定

### N-37 毎回 `favicon.ico 404` の console エラー
- 重大度：**軽微**
- 証跡：全 `results/*.json` の errors
- 推定原因：`index.html` に favicon が無い

### N-38 `Ctrl+G` に空文字で Enter すると R001 にジャンプする
- 重大度：**軽微**
- 証跡：`results/s13_misc.out`
- 推定原因：`src/commands/registry.ts:goto`（`model.includes('')` が常に真）

---

## 3. 使い勝手の問題（重大度：使い勝手）

### U-01 パレットで新人が打つ言葉がヒットしない
- 再現：`Ctrl+K` に `ヘルプ` `help` `undo` `save` `やり直し` `印刷` `エクセル` `新規` `終了` → 「該当する操作がありません」。「該当なし」で Enter しても無反応
- 期待：同義語（ヘルプ→ショートカット一覧、エクセル→Excel、新規→新しいBOM、やり直し→やり直す）や部分一致・英語で引ける
- 証跡：`results/s02_palette.out`、`shots/s02_palette_print.png`
- 原因：`src/commands/registry.ts:paletteItems` がラベル `includes` のみ（`keywords` フィールドは定義だけで未使用）

### U-02 数量セルで数字を打つとビューが切り替わり、カーソルも失う
- 再現：R004 必要数 → `5` → ビュー 5（変更あり）へ移動、カーソルは R001 に
- Excel の習慣（セルで数字を打てば上書き）と衝突。1〜9 のビュー切替はナビモードの仕様だが、数値列に限り上書き編集にする／ステータスバーで「Enter で編集」を強調する等の救済が要る
- 証跡：`results/s03_navtyping.out`

### U-03 読み取り専用列（ID・状態・ボール・必要日 など）で文字を打っても無反応
- 再現：ID 列で `z` → 何も起きない（Enter なら「この列は自動計算です」）
- 証跡：`results/s03_navtyping.out`。原因：`src/commands/registry.ts:1167-1170`（canEdit に失敗したら何もしない）

### U-04 マウスで「押せそうなもの」が押せない
- 列ヘッダをクリックしても並び替えされない／絞り込みチップ（`部品名 = リレー f`）をクリックしても解除できない／ステータスバーのヒント（`Enter 編集` など）は押せない／ガイドの選択肢「3 1つずつ入力」やステップ名をクリックしても選べない／行詳細の指摘をクリックしても選択されない（Enter で編集に入る）
- 証跡：`results/s01_mouse.out`、`results/s05b_wizard.out`（`F click option3`）、`results/s07_filter.out`

### U-05 エラー・結果の通知がステータスバー内の小さな文字で 4 秒で消える
- 「権限なし」「公開できません」「採用しました」「この行（なし）では…」がすべて画面最下段の 12px。別の操作をすると前のトーストが残って読み違える。新人は見落として同じキーを連打する
- 証跡：`shots/s04_publish_blocked.png`、`shots/s13_publish_blocked_after_prompt.png`

### U-06 新規案件作成直後に「4 要確認」へ飛ぶが、問題 0 件だと空の表（「この条件に合う行はありません」）で次が分からない
- 証跡：`results/s05b_wizard.out`（`C[header] … view 4 rows shown 0`）、`shots/s10b_p2_empty_view4.png`

### U-07 貼り付け形式が固定（タブ区切り・列順固定・ヘッダーは部品名/型式のみ）で、取り込み結果のプレビュー・列の対応付けが無い
- カンマ区切り・スペース区切り・列順違い・分類無しはすべてズレて入るのに、取り込み後の案内は「4 要確認で直す」だけ
- 証跡：`shots/s05b_paste_comma.png`、`shots/s05b_paste_excelHeaderJp.png`、`shots/s05b_paste_noCategory.png`

### U-08 役割を切り替えてもビューが役割の既定（設計 4 / 購買 9 / PM 7）にならない。購買で開いても最初は 1 すべて
- 証跡：`results/s10_data.out`（`PM view: 1`）、`results/s11_purchasing.out`（`purchasing default view: 1`）

### U-09 検索が全角・半角を区別する。`Ctrl+G` は部品名で探せない
- `ＦＸ５Ｕ` で 0 件、`Ctrl+G` に `リレー` → 見つかりません
- 証跡：`results/s07_filter.out`、`results/s13_misc.out`

### U-10 `/` を 2 回押すと絞り込みに `/` が入って 0 件になり、Esc 1 回目は値を残したままフォーカスだけ戻る（0 件のまま）
- 証跡：`shots/s07_filter_abc_esc.png`、`results/s07_filter.out`

### U-11 指摘の種別パネルがヘッドレターのみ（フッターには k m d a l q の 6 つだけ、r/h/o は出ない）。Enter・↓・数字・クリックが効かず無反応
- 証跡：`shots/s11_issue_kinds.png`、`results/s11_purchasing.out`

### U-12 「J で次の行」は本文が空のときだけ。本文を打ってから J を押すと `J` が本文に入る。トーストの案内「Ctrl+Enter で発行、J で次の行」はパネルが閉じた後に出る
- 証跡：`results/s11_purchasing.out`（`Shift+J with text: … text メーカを書いてくださいJ`）

### U-13 `r` `h` `Shift+Delete` `a`（再採用）など 1 キーの破壊的操作に確認も通知も無く、Ctrl+Z で戻せることも案内されない（N-05/N-27 の使い勝手面）
- 証跡：`results/s03_navtyping.out`

### U-14 リロードで Undo 履歴が消える。未公開の編集を戻す手段が「もう一度打ち直す」しかない
- 証跡：`results/s08_persist.out`（`Ctrl+Z after reload: 戻す操作がありません`）。ビューとカーソル位置もリロードで 1 / 未選択に戻る

### U-15 破壊的・社外向け操作が Enter 1 回で既定実行される
- 「サンプルデータに戻しますか」は Enter = 1 戻す（既定が破壊側）。「正式見積を依頼（社外）」はパレットで Enter した瞬間に「3 行 × 1 社に正式見積を依頼」（確認無し、ダウンロードも無いので何が起きたか分からない）
- 証跡：`results/s10b_data.out`、`results/s15_followup.out`

### U-16 `Shift+A` で範囲外の数字（3 社しかないのに 9）、`Ctrl+.` の「候補がありません」、指摘アクションパネルで `z` `a` など無効キー → すべて無反応
- 証跡：`results/s14_extra.out`、`results/s06_detail.out`

### U-17 決定パネル・指摘アクションパネルのタイトルが「直し方の候補 R013」で何のパネルか分からない。項目も `1 y 受入 → 正式見積済` のように番号とキーが二重
- 証跡：`shots/s12_decision_panel.png`、`shots/s06_issue_actions.png`

### U-18 JSON 書き出し・Excel 出力・貼り付け（Ctrl+V）の完了通知が無い
- 証跡：`results/s10b_data.out`（`download: … toast null`）、`results/s13_misc.out`（`Excel download: download toast null`）

### U-19 空の案件（行 1、エラー 3）で `n` を押しても何も案内されず、`Ctrl+Enter` は「公開するものがありません」（エラーがあるのに「ありません」）
- 証跡：`results/s05b_wizard.out`（`A empty project …`）

### U-20 ステータスバーのヒントは役割・状況を問わずほぼ固定（`Enter 編集 / a 推奨採用 / Shift+I 指摘 / Space 開く`）。設計に「Shift+I 指摘」、見積前の行に「a 推奨採用」、要決定でない行の PM に「y 承認」が出て、押すと権限なし／要決定ではない
- 証跡：`results/s04_order.out`、`results/s12_pm.out`、`shots/s04_pm_y.png`

### U-21 ガイドの途中入力は Esc（1 段階目）で破棄され、再度開くと空。受信箱の「＋ 新しいBOM を作る」も同じガイド
- 証跡：`results/s05b_wizard.out`（`D reopened id value:` 空）

### U-22 行詳細の見積行は ↓ で選べない（指摘だけ）。Detail 側には見積行のフォーカス表示が実装されているが到達できない
- 証跡：`results/s06_detail.out`（`focus quote row 0`）。原因：`src/commands/registry.ts:move.down` が `detailItems`（指摘のみ）で上限を決める

---

## 4. 合計

| 区分 | 件数 |
| --- | --- |
| 不具合 致命 | 2（N-01, N-02） |
| 不具合 重大 | 7（N-03〜N-09） |
| 不具合 中 | 22（N-10〜N-31） |
| 不具合 軽微 | 7（N-32〜N-38） |
| **不具合 合計** | **38** |
| **使い勝手** | **22**（U-01〜U-22） |

### 最重要 3 件
1. **N-02 / N-01** 白画面：不完全な JSON 読み込みは localStorage に保存されリロードでも復旧しない。予算「100万」も白画面（こちらはリロードで復旧）。ErrorBoundary と入力検証が要る。
2. **N-03 / N-04** 1024〜1280 幅でヘッダーの役割ボタン・`Ctrl+K` ボタンが画面外。マウス中心の新人は役割切替とパレットに辿り着けない。
3. **N-06** 新規 BOM ガイド「部品の入れ方」で 1/2/3 と Enter が効かない（textarea が奪う）。フッター表示と食い違い、ほぼ全員がここで止まる。次点で **N-05**（行未選択でも R001 に採用・置換が走る）と **N-08**（設計の未公開値が購買に見える）。
