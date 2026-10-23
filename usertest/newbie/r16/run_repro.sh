#!/bin/bash
# 新しい不具合の 2 回目（REPRO=1 → *_r2.out）
cd /home/user/BOM/usertest/newbie/r16
export REPRO=1
for s in r11_files16 r13_grid_values16 r14_change_follow16 r16_settings16; do echo "=== $s"; timeout 600 node $s.mjs > results/${s}_r2.stdout 2>&1; echo "exit $? $s"; done
echo "=== r12_paste16"; timeout 900 node r12_paste16.mjs cases/p16.json > results/r12_paste16_r2.stdout 2>&1; echo "exit $? r12"
echo "=== r12b"; LOGNAME2=r12b_paste16b timeout 600 node r12_paste16.mjs cases/p16b.json > results/r12b_r2.stdout 2>&1; echo "exit $? r12b"
echo DONE
