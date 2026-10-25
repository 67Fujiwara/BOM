#!/bin/bash
# ラウンド19: r18 の新規スクリプト（128〜139）を現行（5176, 5bb9df8）と r18 ビルド（5198, 783edde）で流し直す。画面の操作は 5176 で 2 回
cd /home/user/BOM/usertest/veteran/r19
run() { local name=$1; shift; echo "== $name $(date +%T) load=$(cut -d' ' -f1-3 /proc/loadavg)" >> batchN.status; env "$@" > "$name.log" 2>&1; echo "   exit $? $(date +%T)" >> batchN.status; }
run 132-big18-make node 132-big18-make.mjs
run 124-big17-make node 124-big17-make.mjs
run 128-header-wizard node 128-header-wizard.mjs
run 128-header-wizard-5198 BOM_URL=http://localhost:5198/ TAG=-5198 node 128-header-wizard.mjs
run 132-big18 node 132-big18.mjs
run 132-big18-5198 BOM_URL=http://localhost:5198/ TAG=-5198 node 132-big18.mjs
for r in 1 2; do
run 129-json-r18-run$r PORT=5176 RUN=-run$r node 129-json-r18.mjs
run 133-withdrawn-x-run$r PORT=5176 RUN=-run$r node 133-withdrawn-x.mjs
run 134-grid-paste-ml-5176-run$r PORT=5176 RUN=-run$r node 134-grid-paste-ml.mjs
run 139-needoffset-ui-run$r PORT=5176 RUN=-run$r node 139-needoffset-ui.mjs
done
run 129-json-r18-5198 PORT=5198 node 129-json-r18.mjs
run 133-withdrawn-x-5198 PORT=5198 node 133-withdrawn-x.mjs
run 134-grid-paste-ml-5198 PORT=5198 node 134-grid-paste-ml.mjs
run 139-needoffset-ui-5198 PORT=5198 node 139-needoffset-ui.mjs
while [ ! -f dl/137-mutated.json ]; do sleep 10; done
run 137-render-ui-run1 PORT=5176 RUN=-run1 node 137-render-ui.mjs
run 137-render-ui-5197 PORT=5197 node 137-render-ui.mjs
echo DONE >> batchN.status
