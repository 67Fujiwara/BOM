#!/bin/bash
SP=/tmp/claude-0/-home-user-BOM/cac18a95-603a-5fc7-89ba-5680a1690c60/scratchpad
s=$1
cd /home/user/BOM/usertest/veteran/r20
SRC=$SP/v20-patch/src TAG=-patch npx vite-node --config $SP/v20-patch/vite.config.ts $s > ${s%.ts}-patch.log 2>&1
echo "$s patch exit $?"
