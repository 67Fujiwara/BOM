#!/bin/bash
# ラウンド19: r47 の 1 回目（C を直したあと）→ 新規すべての 2 回目（REPRO=1 → *_r2.out）
cd /home/user/BOM/usertest/newbie/r19
timeout 900 node r47_misc19.mjs > results/r47.stdout 2>&1; echo "exit $? r47 first"
REPRO=1 NEW19="r43_excel_keys19 r44_settings_confirm19 r45_change_labels19 r46_postorder19 r47_misc19" ./run_new19.sh
echo REPRODONE
