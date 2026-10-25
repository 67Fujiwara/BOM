#!/bin/bash
# ラウンド17 の新規スクリプト（r21〜r30）を r19 のビルドで流す（前回項目の再検証）
cd /home/user/BOM/usertest/newbie/r19
for s in r22_files17 r23_delete_follow17 r24_dialog_digits17 r25_alldeclined17 r26_explore17 r27_supplier_export17 r29_twotabs17 r30_withdraw17; do echo "=== $s"; timeout 600 node $s.mjs > results/$s.stdout 2>&1; echo "exit $? $s"; done
echo "=== r21"; timeout 900 node r21_paste17.mjs cases/p17.json > results/r21_paste17.stdout 2>&1; echo "exit $? r21"
echo "=== r21b"; LOGNAME2=r21b_paste17b timeout 900 node r21_paste17.mjs cases/p17b.json > results/r21b.stdout 2>&1; echo "exit $? r21b"
echo DONE
