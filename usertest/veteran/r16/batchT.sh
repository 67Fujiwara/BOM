#!/bin/bash
# ラウンド16: r15 の新規スクリプトを現行（5176, bd8881e）と r15 ビルド（5198, b836657）で流し直す。画面の操作は 5176 で 2 回
cd /home/user/BOM/usertest/veteran/r16
run() { local name=$1; shift; echo "== $name $(date +%T) load=$(cut -d' ' -f1-3 /proc/loadavg)" >> batchT.status; env "$@" > "$name.log" 2>&1; echo "   exit $? $(date +%T)" >> batchT.status; }
run 96-header-wizard node 96-header-wizard.mjs
run 96-header-wizard-5198 BOM_URL=http://localhost:5198/ TAG=-5198 node 96-header-wizard.mjs
run 97-xlsx-r15 node 97-xlsx-r15.mjs
run 97-xlsx-r15-5198 BOM_URL=http://localhost:5198/ TAG=-5198 node 97-xlsx-r15.mjs
./probe.sh 97b-xlsx-direct.ts head >> batchT.status
./probe.sh 97b-xlsx-direct.ts r15b >> batchT.status
run 104-header-wizard node 104-header-wizard.mjs
run 104-header-wizard-5198 BOM_URL=http://localhost:5198/ TAG=-5198 node 104-header-wizard.mjs
run 105-redos-xlsx-run1 TAG=-run1 NS=20,24,26,28,40,200 node 105-redos-xlsx.mjs
run 105-redos-xlsx-run2 TAG=-run2 NS=20,24,26,28,40,200 node 105-redos-xlsx.mjs
run 105-redos-xlsx-5198 BOM_URL=http://localhost:5198/ TAG=-5198 NS=20,24,26 node 105-redos-xlsx.mjs
for r in 1 2; do
run 98-f8-anchor-run$r PORT=5176 RUN=-run$r node 98-f8-anchor.mjs
run 99-undo-publish3-run$r PORT=5176 RUN=-run$r node 99-undo-publish3.mjs
run 100-json-r15-run$r PORT=5176 RUN=-run$r node 100-json-r15.mjs
run 101-misc-r15-run$r PORT=5176 RUN=-run$r node 101-misc-r15.mjs
run 103-twotab-undo-run$r PORT=5176 RUN=-run$r node 103-twotab-undo.mjs
done
run 99-undo-publish3-5198 PORT=5198 node 99-undo-publish3.mjs
run 100-json-r15-5198 PORT=5198 node 100-json-r15.mjs
run 103-twotab-undo-5198 PORT=5198 node 103-twotab-undo.mjs
echo DONE >> batchT.status
