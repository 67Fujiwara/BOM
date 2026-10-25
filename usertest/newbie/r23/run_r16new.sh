#!/bin/bash
# ラウンド16 の新規スクリプト（r11〜r17）を r17 のビルドで流す（前回項目の再検証）
cd /home/user/BOM/usertest/newbie/r23
for s in r11_files16 r13_grid_values16 r14_change_follow16 r15_export_roundtrip16 r16_settings16 r17_genkou_follow16; do echo "=== $s"; timeout 600 node $s.mjs > results/$s.stdout 2>&1; echo "exit $? $s"; done
echo "=== r12_paste16"; timeout 900 node r12_paste16.mjs cases/p16.json > results/r12_paste16.stdout 2>&1; echo "exit $? r12"
echo "=== r12b"; LOGNAME2=r12b_paste16b timeout 600 node r12_paste16.mjs cases/p16b.json > results/r12b.stdout 2>&1; echo "exit $? r12b"
echo DONE
