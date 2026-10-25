#!/bin/bash
# 使い方: runlist.sh <リスト>  各スクリプトを順に実行し results/<名前>.stdout に出力
cd /home/user/BOM/usertest/newbie/r22
for s in $(cat $1); do
  timeout 400 node $s.mjs > results/$s.stdout 2>&1; echo "exit $? $s" >> results/_progress_$(basename $1).txt
done
echo DONE >> results/_progress_$(basename $1).txt
