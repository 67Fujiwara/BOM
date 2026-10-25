#!/bin/bash
# r22 までの引数つきスクリプト・重いスクリプトを r23 のビルドで再実行（r22 の出力と突き合わせる）
cd /home/user/BOM/usertest/newbie/r23
./run_param21.sh
LOGNAME2=r80_paste22 timeout 1500 node r80_paste21.mjs cases/p22sel.json > results/r80_paste22.stdout 2>&1; echo "exit $? r80_paste22" >> results/_progress_param.txt
LOGNAME2=r80_paste22b timeout 900 node r80_paste21.mjs cases/p22sel2.json > results/r80_paste22b.stdout 2>&1; echo "exit $? r80_paste22b" >> results/_progress_param.txt
for s in q16_perf r59b_xlsx_all q19_messy_fuzz; do timeout 1200 node $s.mjs > results/$s.stdout 2>&1; echo "exit $? $s" >> results/_progress_param.txt; done
echo ALLDONE >> results/_progress_param.txt
