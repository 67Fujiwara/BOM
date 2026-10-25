#!/bin/bash
# ラウンド18 の新規スクリプト（REPRO=1 を付けると 2 回目 → *_r2.out）
cd /home/user/BOM/usertest/newbie/r18
R=${REPRO:+_r2}
echo "=== r31"; timeout 900 node r31_paste18.mjs cases/p18.json > results/r31$R.stdout 2>&1; echo "exit $? r31"
echo "=== r32"; timeout 600 node r32_files18.mjs > results/r32$R.stdout 2>&1; echo "exit $? r32"
for s in $NEW18; do echo "=== $s"; timeout 600 node $s.mjs > results/$s$R.stdout 2>&1; echo "exit $? $s"; done
echo DONE
