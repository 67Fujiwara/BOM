#!/bin/bash
# ラウンド23 の新規スクリプトを 1 本ずつ流す（負荷を抑える）。引数 REPRO=1 で 2 回目
cd /home/user/BOM/usertest/newbie/r23
R=${1:-}
run() { n=$1; shift; env ${R:+REPRO=1} "$@" > results/$n${R:+_r2}.stdout 2>&1; echo "exit $? $n" >> results/_progress_new${R:+_r2}.txt; }
run s01_seq23 node s01_seq23.mjs
run s04_removed_supplier node s04_removed_supplier.mjs
run s06_supplied_views node s06_supplied_views.mjs
LOGNAME2=r80_paste23 run r80_paste23 node r80_paste21.mjs cases/p23sel.json
LOGNAME2=r80_paste23b run r80_paste23b node r80_paste21.mjs cases/p23sel2.json
run r92_files23 node r92_files23.mjs
echo DONE >> results/_progress_new${R:+_r2}.txt
