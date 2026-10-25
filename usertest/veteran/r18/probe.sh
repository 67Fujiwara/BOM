#!/bin/bash
# vite-node で .ts を直接。1 つ目の引数: スクリプト、2 つ目: head（現行 /home/user/BOM）か r17b（scratchpad の 7236090）
SP=/tmp/claude-0/-home-user-BOM/cac18a95-603a-5fc7-89ba-5680a1690c60/scratchpad
s=$1; which=$2
cd /home/user/BOM/usertest/veteran/r18
if [ "$which" = r17b ]; then SRC=$SP/b-7236090/src TAG=-r17b $EXTRA npx vite-node --config $SP/b-7236090/vite.config.ts $s > ${s%.ts}-r17b.log 2>&1
else npx vite-node --config /home/user/BOM/vite.config.ts $s > ${s%.ts}.log 2>&1; fi
echo "$s $which exit $?"
