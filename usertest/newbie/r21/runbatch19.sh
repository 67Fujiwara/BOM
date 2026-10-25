#!/bin/bash
# ラウンド19: r18 までの全スクリプトを r19 のビルドで流す（4 本並行）。最後に r18 の新規（r31〜r38）
cd /home/user/BOM/usertest/newbie/r21
for i in 0 1 2 3; do ( ./runall.sh $(cat results/list0$i.txt) > results/batch0$i.log 2>&1; echo DONE >> results/batch0$i.log ) & done
( ./run_r0x.sh > results/batchR0x.log 2>&1; ./run_r16new.sh > results/batchR16new.log 2>&1; ./run_r17new.sh > results/batchR17new.log 2>&1; NEW18="r33_supersede18 r35_excel_keys18 r38_untested18" ./run_new18.sh > results/batchNew18.log 2>&1 ) &
wait
echo ALLDONE > results/batch_all.done
