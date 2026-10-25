#!/bin/bash
# ラウンド23 の追加分（F8 の歩き・30 行・チェック結果・商社 S2・第 3 組の貼り付け）を 1 本ずつ。REPRO=1 を付けて 2 回目
cd /home/user/BOM/usertest/newbie/r23
for R in "" 1; do
  sfx=${R:+_r2}
  env ${R:+REPRO=1} node s07_f8_walk.mjs > results/s07$sfx.stdout 2>&1; echo "exit $? s07$sfx" >> results/_progress_new2.txt
  env ${R:+REPRO=1} node s05_flag30.mjs > results/s05$sfx.stdout 2>&1; echo "exit $? s05$sfx" >> results/_progress_new2.txt
  env ${R:+REPRO=1} node s03_export_check.mjs > results/s03$sfx.stdout 2>&1; echo "exit $? s03$sfx" >> results/_progress_new2.txt
  env ${R:+REPRO=1} VICTIM=S2 node s04_removed_supplier.mjs > results/s04_S2$sfx.stdout 2>&1; echo "exit $? s04_S2$sfx" >> results/_progress_new2.txt
  env ${R:+REPRO=1} LOGNAME2=r80_paste23c node r80_paste21.mjs cases/p23sel3.json > results/r80_paste23c$sfx.stdout 2>&1; echo "exit $? r80_paste23c$sfx" >> results/_progress_new2.txt
done
echo DONE >> results/_progress_new2.txt
