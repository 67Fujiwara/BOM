#!/bin/bash
cd /home/user/BOM/usertest/veteran/r23
run() { local name=$1; shift; echo "== $name $(date +%T)" >> rerun.status; nice -n 8 env "$@" > "$name.log" 2>&1; echo "   exit $? $(date +%T)" >> rerun.status; }
run 41b-norow-ctrl-5176 PORT=5176 node r12-41b-norow-ctrl.mjs
run 71-numpad-roles-5176 PORT=5176 node r13-71-numpad-roles.mjs
run 90-dialog-r14-run1 PORT=5176 RUN=-run1 node 90-dialog-r14.mjs
run 98-f8-anchor-run1 PORT=5176 RUN=-run1 node 98-f8-anchor.mjs
run 69-reload-r13 node r13-69-reload-r13.mjs
run 24-storage-actions-5176b PORT=5176 node r11-24-storage-actions.mjs
echo DONE >> rerun.status
