#!/bin/bash
# vite-node で .ts を直接。1 つ目: スクリプト、2 つ目: head（現行 /home/user/BOM = ead0276）か r22b（scratchpad の v23/r22b = 68e45f7）
SP=/tmp/claude-0/-home-user-BOM/cac18a95-603a-5fc7-89ba-5680a1690c60/scratchpad/v23
s=$1; which=$2
cd /home/user/BOM/usertest/veteran/r23
if [ "$which" = r22b ]; then env SRC=$SP/r22b/src TAG=-r22b npx vite-node --config $SP/r22b/vite.config.ts $s > ${s%.ts}-r22b.log 2>&1
else npx vite-node --config /home/user/BOM/vite.config.ts $s > ${s%.ts}.log 2>&1; fi
echo "$s $which exit $?"
