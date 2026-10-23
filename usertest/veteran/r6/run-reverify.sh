#!/bin/bash
cd /home/user/BOM/usertest/veteran/r6/rerun5
node 35-malformed3.mjs > 35-malformed3.log 2>&1
node 37-crash-restore.mjs > 37-crash-restore.log 2>&1
node 40-backup-tz.mjs > 40-backup-tz.log 2>&1
node 42-files2.mjs > 42-files2.log 2>&1
NS=80,2100,3000 node 36-undo-order.mjs > 36-undo-order.log 2>&1
node 55-malformed4.mjs > ../55-malformed4.log 2>&1
cd ../rerun4
node 25-palette.mjs > 25-palette.log 2>&1
node 22-malformed2.mjs > 22-malformed2.log 2>&1
echo DONE > ../run-reverify.done
