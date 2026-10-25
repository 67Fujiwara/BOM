#!/bin/bash
# r16 までの古いスクリプトを 4 本並行で流す（results/list0N.txt の順）
cd /home/user/BOM/usertest/newbie/r19
for i in 0 1 2 3; do ( ./runall.sh $(cat results/list0$i.txt) > results/batch0$i.log 2>&1; echo DONE >> results/batch0$i.log ) & done
( ./run_r0x.sh > results/batchR0x.log 2>&1; ./run_r16new.sh > results/batchR16new.log 2>&1; ./run_r17new.sh > results/batchR17new.log 2>&1 ) &
wait
echo ALLDONE > results/batch_all.done
