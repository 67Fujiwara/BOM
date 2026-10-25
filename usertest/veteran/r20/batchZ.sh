#!/bin/bash
# ラウンド19: r17 の新規手順（121〜127）の再実行（r18 の batchN にあったもの）。現行（5176）× 2 回＋r18 ビルド（5198）、ガイドは 2 ビルド
cd /home/user/BOM/usertest/veteran/r20
while ! grep -q DONE batchY.status 2>/dev/null; do sleep 10; done
run() { local name=$1; shift; echo "== $name $(date +%T) load=$(cut -d' ' -f1-3 /proc/loadavg)" >> batchZ.status; env "$@" > "$name.log" 2>&1; echo "   exit $? $(date +%T)" >> batchZ.status; }
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
echo DONE >> batchZ.status
