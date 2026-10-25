#!/bin/bash
cd /home/user/BOM/usertest/veteran/r21
run() { local name=$1; shift; echo "== $name $(date +%T) load=$(cut -d' ' -f1-3 /proc/loadavg)" >> batchM.status; nice -n 6 env "$@" > "$name.log" 2>&1; echo "   exit $? $(date +%T)" >> batchM.status; }
run 03-entry-matrix-5176 PORT=5176 node r11-03-entry-matrix.mjs
run 13-alt-sweep-5176 PORT=5176 node r11-13-alt-sweep.mjs
run 16-deselect-arrow-5176 PORT=5176 node r11-16-deselect-arrow.mjs
run 21-f2-modes-5176 PORT=5176 node r11-21-f2-modes.mjs
run 23-norow-keys-5176 PORT=5176 node r11-23-norow-keys.mjs
run 20-f8-more-5176 PORT=5176 node r11-20-f8-more.mjs
run 40-f8-cursor-5176 PORT=5176 node r12-40-f8-cursor.mjs
run 86-f8-r14-run1 PORT=5176 RUN=-run1 node 86-f8-r14.mjs
run 26-twotab-new-5176 PORT=5176 node r11-26-twotab-new.mjs
run 45-twotab-conflict-5176 PORT=5176 node r12-45-twotab-conflict.mjs
run 24-storage-actions-5176 PORT=5176 node r11-24-storage-actions.mjs
run 36-undo-chain PORT=5176 node r11-r9-36-undo-chain.mjs
echo DONE >> batchM.status
