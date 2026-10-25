#!/bin/bash
# vite-node で .ts を直接。1 つ目の引数: スクリプト、2 つ目: head（現行 /home/user/BOM, 688ceb6）か r19b（scratchpad の 5bb9df8 = r19 ビルド）
SP=/tmp/claude-0/-home-user-BOM/cac18a95-603a-5fc7-89ba-5680a1690c60/scratchpad
s=$1; which=$2
cd /home/user/BOM/usertest/veteran/r20
if [ "$which" = r19b ]; then SRC=$SP/v19-5bb9df8/src TAG=-r19b $EXTRA npx vite-node --config $SP/v19-5bb9df8/vite.config.ts $s > ${s%.ts}-r19b.log 2>&1
else npx vite-node --config /home/user/BOM/vite.config.ts $s > ${s%.ts}.log 2>&1; fi
echo "$s $which exit $?"
