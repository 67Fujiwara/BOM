#!/bin/bash
# ラウンド19 の新規スクリプト（REPRO=1 を付けると 2 回目 → *_r2.out）
cd /home/user/BOM/usertest/newbie/r23
R=${REPRO:+_r2}
echo "=== r41"; timeout 1500 node r41_paste19.mjs cases/p19.json > results/r41$R.stdout 2>&1; echo "exit $? r41"
echo "=== r42"; timeout 900 node r42_files19.mjs > results/r42$R.stdout 2>&1; echo "exit $? r42"
for s in $NEW19; do echo "=== $s"; timeout 900 node $s.mjs > results/$s$R.stdout 2>&1; echo "exit $? $s"; done
echo DONE
