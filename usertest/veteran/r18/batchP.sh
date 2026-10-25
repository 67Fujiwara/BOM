#!/bin/bash
# ラウンド18: 取り込みの直接呼び出し（vite-node）を現行（HEAD 783edde）と r17 ビルド（7236090）の src で
cd /home/user/BOM/usertest/veteran/r18
while [ ! -f dl/b6-change25.xlsx ] && ! ls dl/b6* >/dev/null 2>&1; do sleep 5; done; sleep 5
for s in 122-header-probe.ts 124b-big17-direct.ts 120-normalize-fuzz.ts 106-header-probe.ts 104-header-probe.ts 95-header-probe.ts 80-header-probe.ts r13-60-header-unit.ts 97b-xlsx-direct.ts 108b-xlsx-direct.ts; do
  ./probe.sh $s head >> batchP.status
  ./probe.sh $s r17b >> batchP.status
done
echo DONE >> batchP.status
