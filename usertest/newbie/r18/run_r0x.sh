#!/bin/bash
# ラウンド15 の新規スクリプト r01〜r08 を r16 のビルドで流す（r02 は cases/p15.json）
cd /home/user/BOM/usertest/newbie/r18
for s in r01_files15 r03_grid_ditto_tbd r04_name15 r05_projects r06_json_misuse r07_estimate_follow r08_copy_roundtrip; do echo "=== $s"; timeout 600 node $s.mjs > results/$s.stdout 2>&1; echo "exit $? $s"; done
echo "=== r02_paste15"; timeout 600 node r02_paste15.mjs cases/p15.json > results/r02_paste15.stdout 2>&1; echo "exit $? r02_paste15"
echo DONE
