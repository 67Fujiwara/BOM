#!/bin/bash
# 引数なしで流せる旧スクリプトを 3 本並行で
cd /home/user/BOM/usertest/newbie/r22
split -n l/3 -d "$1" results/_lst_
for p in results/_lst_0*; do ( ./runall.sh $(cat $p) > $p.log 2>&1; echo DONE >> $p.log ) & done
wait
echo ALLDONE > results/batch_all.done
