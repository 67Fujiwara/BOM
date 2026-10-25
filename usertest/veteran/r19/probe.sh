#!/bin/bash
# vite-node で .ts を直接。1 つ目の引数: スクリプト、2 つ目: head（現行 /home/user/BOM, 5bb9df8）か r18b（scratchpad の 783edde）
SP=/tmp/claude-0/-home-user-BOM/cac18a95-603a-5fc7-89ba-5680a1690c60/scratchpad
s=$1; which=$2
cd /home/user/BOM/usertest/veteran/r19
if [ "$which" = r18b ]; then SRC=$SP/v19-783edde/src TAG=-r18b $EXTRA npx vite-node --config $SP/v19-783edde/vite.config.ts $s > ${s%.ts}-r18b.log 2>&1
else npx vite-node --config /home/user/BOM/vite.config.ts $s > ${s%.ts}.log 2>&1; fi
echo "$s $which exit $?"
