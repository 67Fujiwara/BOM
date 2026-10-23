#!/bin/bash
# ラウンド16: 新規スクリプト（106〜112）。取り込みは現行（5176）と r15 ビルド（5198）、画面の操作は 5176 で 2 回＋r15 ビルド
cd /home/user/BOM/usertest/veteran/r16
run() { local name=$1; shift; echo "== $name $(date +%T) load=$(cut -d' ' -f1-3 /proc/loadavg)" >> batchN.status; env "$@" > "$name.log" 2>&1; echo "   exit $? $(date +%T)" >> batchN.status; }
run 107-header-wizard node 107-header-wizard.mjs
run 107-header-wizard-5198 BOM_URL=http://localhost:5198/ TAG=-5198 node 107-header-wizard.mjs
run 108-xlsx-r16 node 108-xlsx-r16.mjs
run 108-xlsx-r16-5198 BOM_URL=http://localhost:5198/ TAG=-5198 node 108-xlsx-r16.mjs
./probe.sh 108b-xlsx-direct.ts head >> batchN.status
./probe.sh 108b-xlsx-direct.ts r15b >> batchN.status
for r in 1 2; do
run 110-undo-publish4-run$r PORT=5176 RUN=-run$r node 110-undo-publish4.mjs
run 111-mac-ctrl-mac-run$r PORT=5176 PLAT=mac RUN=-run$r node 111-mac-ctrl.mjs
run 112-json-r16-run$r PORT=5176 RUN=-run$r node 112-json-r16.mjs
done
run 109-wizard-paste-r16 SHOT=p1-kyushin-name-up-repeat-300,p3-sparse-maker-written-300 node 109-wizard-paste-r16.mjs
run 109-wizard-paste-r16-5198 BOM_URL=http://localhost:5198/ TAG=-5198 node 109-wizard-paste-r16.mjs
run 111-mac-ctrl-linux PORT=5176 PLAT=linux node 111-mac-ctrl.mjs
run 110-undo-publish4-5198 PORT=5198 node 110-undo-publish4.mjs
run 112-json-r16-5198 PORT=5198 node 112-json-r16.mjs
run 113-dup-tab-run1 PORT=5176 RUN=-run1 node 113-dup-tab.mjs
run 113-dup-tab-run2 PORT=5176 RUN=-run2 node 113-dup-tab.mjs
echo DONE >> batchN.status
