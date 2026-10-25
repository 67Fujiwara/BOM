#!/bin/bash
# vite-node で .ts を直接。1 つ目: スクリプト、2 つ目: head（現行 /home/user/BOM = 68e45f7）か r21b（scratchpad の v22/r21b = 56e5aba）
SP=/tmp/claude-0/-home-user-BOM/cac18a95-603a-5fc7-89ba-5680a1690c60/scratchpad/v22
s=$1; which=$2
cd /home/user/BOM/usertest/veteran/r22
if [ "$which" = r21b ]; then SRC=$SP/r21b/src TAG=-r21b $EXTRA npx vite-node --config $SP/r21b/vite.config.ts $s > ${s%.ts}-r21b.log 2>&1
else $EXTRA npx vite-node --config /home/user/BOM/vite.config.ts $s > ${s%.ts}.log 2>&1; fi
echo "$s $which exit $?"
