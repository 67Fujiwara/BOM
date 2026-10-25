#!/bin/bash
# ラウンド17（再開）: r14 の新規スクリプトを現行（5176, 7236090）と r16 ビルド（5198, bd8881e）で流し直す。画面の操作は 5176 で 2 回
cd /home/user/BOM/usertest/veteran/r17
run() { local name=$1; shift; echo "== $name $(date +%T) load=$(cut -d" " -f1-3 /proc/loadavg)" >> batchS.status; env "$@" > "$name.log" 2>&1; echo "   exit $? $(date +%T)" >> batchS.status; }
run 91-twotab-wizard node 91-twotab-wizard.mjs
for r in 1 2; do
run 83-twotab-publish-run$r PORT=5176 RUN=-run$r node 83-twotab-publish.mjs
run 84-undo-publish2-run$r PORT=5176 RUN=-run$r node 84-undo-publish2.mjs
run 85-json-r14-run$r PORT=5176 RUN=-run$r node 85-json-r14.mjs
run 85b-json-protoid-run$r PORT=5176 RUN=-run$r node 85b-json-protoid.mjs
run 86-f8-r14-run$r PORT=5176 RUN=-run$r node 86-f8-r14.mjs
run 90-dialog-r14-run$r PORT=5176 RUN=-run$r node 90-dialog-r14.mjs
run 92-storage-publish-run$r PORT=5176 RUN=-run$r node 92-storage-publish.mjs
run 93-misc-r14-run$r PORT=5176 RUN=-run$r node 93-misc-r14.mjs
done
run 84-undo-publish2-5198 PORT=5198 node 84-undo-publish2.mjs
run 85-json-r14-5198 PORT=5198 node 85-json-r14.mjs
run 86-f8-r14-5198 PORT=5198 node 86-f8-r14.mjs
run 93-misc-r14-5198 PORT=5198 node 93-misc-r14.mjs
echo DONE >> batchS.status
