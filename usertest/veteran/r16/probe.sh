#!/bin/bash
# vite-node で .ts を直接。1 つ目の引数: スクリプト、2 つ目: head（現行 /home/user/BOM）か r15b（scratchpad の b836657）
SP=/tmp/claude-0/-home-user-BOM/cac18a95-603a-5fc7-89ba-5680a1690c60/scratchpad
s=$1; which=$2
cd /home/user/BOM/usertest/veteran/r16
if [ "$which" = r15b ]; then SRC=$SP/b-b836657/src TAG=-r15b $EXTRA npx vite-node --config $SP/b-b836657/vite.config.ts $s > ${s%.ts}-r15b.log 2>&1
else npx vite-node --config /home/user/BOM/vite.config.ts $s > ${s%.ts}.log 2>&1; fi
echo "$s $which exit $?"
