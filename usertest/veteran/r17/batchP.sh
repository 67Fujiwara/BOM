#!/bin/bash
# ラウンド17: 取り込みの直接呼び出し（vite-node）を現行（HEAD 7236090）と r16 ビルド（bd8881e）の src で
cd /home/user/BOM/usertest/veteran/r17
for s in 106-header-probe.ts 104-header-probe.ts 95-header-probe.ts 80-header-probe.ts r13-60-header-unit.ts 97b-xlsx-direct.ts 108b-xlsx-direct.ts; do
  ./probe.sh $s head >> batchP.status
  ./probe.sh $s r16b >> batchP.status
done
echo DONE >> batchP.status
