#!/bin/bash
# vite-node で .ts を直接。1 つ目: スクリプト、2 つ目: head（現行 /home/user/BOM = 56e5aba）か r20b（scratchpad の v21/r20b = 688ceb6）
SP=/tmp/claude-0/-home-user-BOM/cac18a95-603a-5fc7-89ba-5680a1690c60/scratchpad/v21
s=$1; which=$2
cd /home/user/BOM/usertest/veteran/r21
if [ "$which" = r20b ]; then SRC=$SP/r20b/src TAG=-r20b $EXTRA npx vite-node --config $SP/r20b/vite.config.ts $s > ${s%.ts}-r20b.log 2>&1
else npx vite-node --config /home/user/BOM/vite.config.ts $s > ${s%.ts}.log 2>&1; fi
echo "$s $which exit $?"
