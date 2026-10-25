#!/bin/bash
# ラウンド19: 141-excel-keys（Linux / mac × 2 回＋r18 ビルド）
cd /home/user/BOM/usertest/veteran/r19
run() { local name=$1; shift; echo "== $name $(date +%T) load=$(cut -d' ' -f1-3 /proc/loadavg)" >> batchK.status; env "$@" > "$name.log" 2>&1; echo "   exit $? $(date +%T)" >> batchK.status; }
for r in 1 2; do
run 141-excel-keys-linux-run$r PORT=5176 PLAT=linux RUN=-run$r node 141-excel-keys.mjs
run 141-excel-keys-mac-run$r PORT=5176 PLAT=mac RUN=-run$r node 141-excel-keys.mjs
done
run 141-excel-keys-linux-5198 PORT=5198 PLAT=linux node 141-excel-keys.mjs
run 141-excel-keys-mac-5198 PORT=5198 PLAT=mac node 141-excel-keys.mjs
echo DONE >> batchK.status
