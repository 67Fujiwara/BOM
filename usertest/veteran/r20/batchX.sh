#!/bin/bash
# ラウンド19 の新規手順（142・143・145・147 × 2 回＋r18 ビルド、144 の 300 行を 2 ビルドのガイドで）
cd /home/user/BOM/usertest/veteran/r20
run() { local name=$1; shift; echo "== $name $(date +%T) load=$(cut -d' ' -f1-3 /proc/loadavg)" >> batchX.status; env "$@" > "$name.log" 2>&1; echo "   exit $? $(date +%T)" >> batchX.status; }
run 144-big19 node 144-big19.mjs
run 144-big19-5198 BOM_URL=http://localhost:5198/ TAG=-5198 node 144-big19.mjs
run 147-grid-paste-inch-run1 PORT=5176 RUN=-run1 node 147-grid-paste-inch.mjs
run 147-grid-paste-inch-run2 PORT=5176 RUN=-run2 node 147-grid-paste-inch.mjs
run 147-grid-paste-inch-5198 PORT=5198 node 147-grid-paste-inch.mjs
run 142-json-r19-run2 PORT=5176 RUN=-run2 node 142-json-r19.mjs
run 142-json-r19-5198 PORT=5198 node 142-json-r19.mjs
run 143-twotab-decision-run2 PORT=5176 RUN=-run2 node 143-twotab-decision.mjs
run 143-twotab-decision-5198 PORT=5198 node 143-twotab-decision.mjs
run 145-needdate-year-run2 PORT=5176 RUN=-run2 node 145-needdate-year.mjs
run 145-needdate-year-5198 PORT=5198 node 145-needdate-year.mjs
echo DONE >> batchX.status
