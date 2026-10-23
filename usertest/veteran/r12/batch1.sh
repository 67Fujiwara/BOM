#!/bin/bash
cd /home/user/BOM/usertest/veteran/r12
run() { local name=$1; shift; echo "== $name $(date +%T) load=$(cut -d' ' -f1-3 /proc/loadavg)" >> batch1.status; env "$@" > "$name.log" 2>&1; echo "   exit $? $(date +%T)" >> batch1.status; }
run 20-f8-more-5176 PORT=5176 node r11-20-f8-more.mjs
run 20-f8-more-5198 PORT=5198 node r11-20-f8-more.mjs
run 01-f8-view-5176 PORT=5176 node r11-01-f8-view.mjs
run 01b-f8-filter-5176 PORT=5176 node r11-01b-f8-filter.mjs
run r9-12-f8flow PORT=5176 node r11-r9-12-f8flow.mjs
run 23-norow-keys-5176 PORT=5176 node r11-23-norow-keys.mjs
run 24-storage-actions-5176 PORT=5176 node r11-24-storage-actions.mjs
run 24b-storage-actions2-5176 PORT=5176 node r11-24b-storage-actions2.mjs
run 10-storage-full-5176 PORT=5176 node r11-10-storage-full.mjs
run 10b-storage-paste-5176 PORT=5176 node r11-10b-storage-paste.mjs
run 27-files8 PORT=5176 node r11-27-files8.mjs
run 08-files7 PORT=5176 node r11-08-files7.mjs
run 26-twotab-new-5176 PORT=5176 node r11-26-twotab-new.mjs
run 04-twotab-5176 PORT=5176 node r11-04-twotab.mjs
run 25-undo200-5176 PORT=5176 node r11-25-undo200.mjs
run 29-json-new-5176 PORT=5176 node r11-29-json-new.mjs
run 07-json-import-5176 PORT=5176 node r11-07-json-import.mjs
run 07b-json-values PORT=5176 node r11-07b-json-values.mjs
run 09-dialog-digits-5176 PORT=5176 node r11-09-dialog-digits.mjs
run 22-dialog-digits2-5176 PORT=5176 node r11-22-dialog-digits2.mjs
run 16-deselect-arrow-5176 PORT=5176 node r11-16-deselect-arrow.mjs
run 02-arrows-5176 PORT=5176 node r11-02-arrows.mjs
run 21-f2-modes-5176 PORT=5176 node r11-21-f2-modes.mjs
echo DONE >> batch1.status
