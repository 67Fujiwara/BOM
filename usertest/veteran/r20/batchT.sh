#!/bin/bash
# ラウンド18: r16・r15 の新規スクリプトを現行（5176, 783edde）と r17 ビルド（5198, 783edde）で流し直す。画面の操作は 5176 で 2 回
cd /home/user/BOM/usertest/veteran/r20
# （r19: batchN の 137 と並べて流す）
run() { local name=$1; shift; echo "== $name $(date +%T) load=$(cut -d' ' -f1-3 /proc/loadavg)" >> batchT.status; env "$@" > "$name.log" 2>&1; echo "   exit $? $(date +%T)" >> batchT.status; }
run 107-header-wizard node 107-header-wizard.mjs
run 107-header-wizard-5198 BOM_URL=http://localhost:5198/ TAG=-5198 node 107-header-wizard.mjs
run 108-xlsx-r16 node 108-xlsx-r16.mjs
run 108-xlsx-r16-5198 BOM_URL=http://localhost:5198/ TAG=-5198 node 108-xlsx-r16.mjs
run 109-wizard-paste-r16 node 109-wizard-paste-r16.mjs
run 109-wizard-paste-r16-5198 BOM_URL=http://localhost:5198/ TAG=-5198 node 109-wizard-paste-r16.mjs
for r in 1 2; do
run 110-undo-publish4-run$r PORT=5176 RUN=-run$r node 110-undo-publish4.mjs
run 111-mac-ctrl-mac-run$r PORT=5176 PLAT=mac RUN=-run$r node 111-mac-ctrl.mjs
run 112-json-r16-run$r PORT=5176 RUN=-run$r node 112-json-r16.mjs
run 113-dup-tab-run$r PORT=5176 RUN=-run$r node 113-dup-tab.mjs
run 114-mac-ctrl-typed-mac-run$r PORT=5176 PLAT=mac RUN=-run$r node 114-mac-ctrl-typed.mjs
done
run 111-mac-ctrl-linux PORT=5176 PLAT=linux node 111-mac-ctrl.mjs
run 114-mac-ctrl-typed-linux PORT=5176 PLAT=linux node 114-mac-ctrl-typed.mjs
run 110-undo-publish4-5198 PORT=5198 node 110-undo-publish4.mjs
run 112-json-r16-5198 PORT=5198 node 112-json-r16.mjs
run 113-dup-tab-5198 PORT=5198 node 113-dup-tab.mjs
run 111-mac-ctrl-mac-5198 PORT=5198 PLAT=mac node 111-mac-ctrl.mjs
# r15 の新規手順
run 96-header-wizard node 96-header-wizard.mjs
run 97-xlsx-r15 node 97-xlsx-r15.mjs
run 104-header-wizard node 104-header-wizard.mjs
run 105-redos-xlsx-run1 TAG=-run1 NS=20,24,26,28,40,200 node 105-redos-xlsx.mjs
for r in 1 2; do
run 98-f8-anchor-run$r PORT=5176 RUN=-run$r node 98-f8-anchor.mjs
run 99-undo-publish3-run$r PORT=5176 RUN=-run$r node 99-undo-publish3.mjs
run 100-json-r15-run$r PORT=5176 RUN=-run$r node 100-json-r15.mjs
run 101-misc-r15-run$r PORT=5176 RUN=-run$r node 101-misc-r15.mjs
run 103-twotab-undo-run$r PORT=5176 RUN=-run$r node 103-twotab-undo.mjs
done
echo DONE >> batchT.status
