#!/bin/bash
# r22 までの全スクリプトを r23 のビルドで再実行する（引数なしのもの）。$1: 一覧ファイル
cd /home/user/BOM/usertest/newbie/r23
for s in $(cat "$1"); do timeout 600 node $s.mjs > results/$s.stdout 2>&1; echo "exit $? $s" >> results/_progress_$(basename $1).txt; done
echo DONE >> results/_progress_$(basename $1).txt
