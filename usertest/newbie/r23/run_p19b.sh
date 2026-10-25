#!/bin/bash
# ラウンド19: cases/p19b.json（変更図 その 8）を 2 回（1 回目 → r41b_paste19b、2 回目 → r41b_paste19b_r2）
cd /home/user/BOM/usertest/newbie/r23
LOGNAME2=r41b_paste19b timeout 900 node r41_paste19.mjs cases/p19b.json > results/r41b.stdout 2>&1; echo "exit $? r41b"
REPRO=1 LOGNAME2=r41b_paste19b timeout 900 node r41_paste19.mjs cases/p19b.json > results/r41b_r2.stdout 2>&1; echo "exit $? r41b_r2"
echo DONE
