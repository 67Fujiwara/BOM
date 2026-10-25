#!/bin/bash
# ラウンド17 の新規スクリプトの 2 回目（REPRO=1 → *_r2.out）
cd /home/user/BOM/usertest/newbie/r17
export REPRO=1
for s in r22_files17 r23_delete_follow17 r24_dialog_digits17 r25_alldeclined17 r26_explore17 r27_supplier_export17 r29_twotabs17 r30_withdraw17; do echo "=== $s"; timeout 600 node $s.mjs > results/${s}_r2.stdout 2>&1; echo "exit $? $s"; done
echo "=== r21"; timeout 900 node r21_paste17.mjs cases/p17.json > results/r21_r2.stdout 2>&1; echo "exit $? r21"
echo "=== r21b"; LOGNAME2=r21b_paste17b timeout 900 node r21_paste17.mjs cases/p17b.json > results/r21b_r2.stdout 2>&1; echo "exit $? r21b"
echo DONE
