#!/bin/bash
# ラウンド18: r17 の新規スクリプト（120〜127）を現行（5176, 783edde）と r17 ビルド（5198, 7236090）で流し直す。画面の操作は 5176 で 2 回
cd /home/user/BOM/usertest/veteran/r18
run() { local name=$1; shift; echo "== $name $(date +%T) load=$(cut -d' ' -f1-3 /proc/loadavg)" >> batchN.status; env "$@" > "$name.log" 2>&1; echo "   exit $? $(date +%T)" >> batchN.status; }
run 124-big17-make node 124-big17-make.mjs
run 122-header-wizard node 122-header-wizard.mjs
run 122-header-wizard-5198 BOM_URL=http://localhost:5198/ TAG=-5198 node 122-header-wizard.mjs
run 124-big17 node 124-big17.mjs
run 124-big17-5198 BOM_URL=http://localhost:5198/ TAG=-5198 node 124-big17.mjs
for r in 1 2; do
run 121-normalize-crash-run$r PORT=5176 RUN=-run$r node 121-normalize-crash.mjs
run 123-undo-publish5-run$r PORT=5176 RUN=-run$r node 123-undo-publish5.mjs
run 125-json-r17-run$r PORT=5176 RUN=-run$r node 125-json-r17.mjs
run 127-deep-nest-run$r PORT=5176 RUN=-run$r node 127-deep-nest.mjs
done
run 121-normalize-crash-5197 PORT=5197 node 121-normalize-crash.mjs
run 121-normalize-crash-5198 PORT=5198 node 121-normalize-crash.mjs
run 123-undo-publish5-5198 PORT=5198 node 123-undo-publish5.mjs
run 125-json-r17-5198 PORT=5198 node 125-json-r17.mjs
run 127-deep-nest-5198 PORT=5198 node 127-deep-nest.mjs
echo DONE >> batchN.status
