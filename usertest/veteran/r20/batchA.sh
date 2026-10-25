#!/bin/bash
cd /home/user/BOM/usertest/veteran/r20
# batchR と並行に流す（batchS のあと）
while ! grep -q DONE batchS.status 2>/dev/null; do sleep 10; done
run() { local name=$1; shift; echo "== $name $(date +%T) load=$(cut -d' ' -f1-3 /proc/loadavg)" >> batchA.status; env "$@" > "$name.log" 2>&1; echo "   exit $? $(date +%T)" >> batchA.status; }
run 41-norow-view-5176 PORT=5176 node r12-41-norow-view.mjs
run 41-norow-view-5198 PORT=5198 node r12-41-norow-view.mjs
run 47-excel-new BOM_URL=http://localhost:5176/ node r12-47-excel-new.mjs
run 47-excel-new-5198 BOM_URL=http://localhost:5198/ TAG=-5198 node r12-47-excel-new.mjs
run 47-excel-new-b BOM_URL=http://localhost:5176/ TAG=-b FILES=x11-no-qty-col,x12-hidden-price,x10-hidden-model-visible-empty node r12-47-excel-new.mjs
run 27-files8 PORT=5176 node r11-27-files8.mjs
run 45b-twotab-publish-5176 PORT=5176 node r12-45b-twotab-publish.mjs
run 45-twotab-conflict-5176 PORT=5176 node r12-45-twotab-conflict.mjs
run 22-dialog-digits2-5176 PORT=5176 node r11-22-dialog-digits2.mjs
run 09-dialog-digits-5176 PORT=5176 node r11-09-dialog-digits.mjs
run 42-dialog-tab-5176 PORT=5176 node r12-42-dialog-tab.mjs
run 42b-dialog-refuse-5176 PORT=5176 node r12-42b-dialog-refuse.mjs
run 44-storage-flag-5176 PORT=5176 node r12-44-storage-flag.mjs
run 43-typed-ctrlz-5176 PORT=5176 node r12-43-typed-ctrlz.mjs
run 46-json-new-5176 PORT=5176 node r12-46-json-new.mjs
run 29-json-new-5176 PORT=5176 node r11-29-json-new.mjs
run 40-f8-cursor-5176 PORT=5176 node r12-40-f8-cursor.mjs
run 20-f8-more-5176 PORT=5176 node r11-20-f8-more.mjs
run r9-12-f8flow PORT=5176 node r11-r9-12-f8flow.mjs
echo DONE >> batchA.status
