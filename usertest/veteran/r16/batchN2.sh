#!/bin/bash
# ラウンド16: 新規スクリプトの続き（batchN のあと）。109 ガイドの貼り付け（2 ビルド）、113 タブの複製（2 回）、114 macOS の Control+英字を打っている途中（2 回＋Linux）
cd /home/user/BOM/usertest/veteran/r16
while ! grep -q DONE batchN.status 2>/dev/null; do sleep 10; done
run() { local name=$1; shift; echo "== $name $(date +%T) load=$(cut -d' ' -f1-3 /proc/loadavg)" >> batchN2.status; env "$@" > "$name.log" 2>&1; echo "   exit $? $(date +%T)" >> batchN2.status; }
run 109-wizard-paste-r16 SHOT=p1-kyushin-name-up-repeat-300,p3-sparse-maker-written-300 node 109-wizard-paste-r16.mjs
run 109-wizard-paste-r16-5198 BOM_URL=http://localhost:5198/ TAG=-5198 node 109-wizard-paste-r16.mjs
run 113-dup-tab-run1 PORT=5176 RUN=-run1 node 113-dup-tab.mjs
run 113-dup-tab-run2 PORT=5176 RUN=-run2 node 113-dup-tab.mjs
run 113-dup-tab-5198 PORT=5198 node 113-dup-tab.mjs
run 114-mac-ctrl-typed-run1 PORT=5176 PLAT=mac RUN=-run1 node 114-mac-ctrl-typed.mjs
run 114-mac-ctrl-typed-run2 PORT=5176 PLAT=mac RUN=-run2 node 114-mac-ctrl-typed.mjs
run 114-mac-ctrl-typed-linux PORT=5176 PLAT=linux node 114-mac-ctrl-typed.mjs
echo DONE >> batchN2.status
