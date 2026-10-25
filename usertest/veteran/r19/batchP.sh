#!/bin/bash
# ラウンド19: 取り込み・読み込みの直接呼び出し（vite-node）を現行（HEAD 5bb9df8）と r18 ビルド（783edde）の src で
cd /home/user/BOM/usertest/veteran/r19
while [ ! -f dl/c7-maker-dnp-300.xlsx ]; do sleep 5; done; sleep 3
DUMP=/home/user/BOM/usertest/veteran/r19/dl/137-mutated.json N=120 SEED=37 npx vite-node --config /home/user/BOM/vite.config.ts 131-render-fuzz.ts > 131-dump.log 2>&1; echo "dump exit $?" >> batchP.status
for s in 128-header-probe.ts 132b-big18-direct.ts 122-header-probe.ts 124b-big17-direct.ts 106-header-probe.ts 104-header-probe.ts 95-header-probe.ts 80-header-probe.ts r13-60-header-unit.ts 97b-xlsx-direct.ts 108b-xlsx-direct.ts 138-needoffset-range.ts; do
  ./probe.sh $s head >> batchP.status
  ./probe.sh $s r18b >> batchP.status
done
TAG=-s19 SEED=19 ./probe.sh 131-render-fuzz.ts head >> batchP.status
EXTRA= SEED=19 ./probe.sh 131-render-fuzz.ts r18b >> batchP.status
./probe.sh 120-normalize-fuzz.ts head >> batchP.status
./probe.sh 120-normalize-fuzz.ts r18b >> batchP.status
./probe.sh 136-parse-time.ts head >> batchP.status
./probe.sh 136-parse-time.ts r18b >> batchP.status
echo DONE >> batchP.status
