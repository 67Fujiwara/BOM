#!/bin/bash
cd /home/user/BOM/usertest/veteran/r11
run() { local name=$1; shift; echo "== $name $(date +%T)" >> batch1.status; env "$@" > "$name.log" 2>&1; echo "   exit $? $(date +%T)" >> batch1.status; }
run 01-f8-view-5176 PORT=5176 node r10-01-f8-view.mjs
run 01-f8-view-5198 PORT=5198 node r10-01-f8-view.mjs
run 01b-f8-filter-5176 PORT=5176 node r10-01b-f8-filter.mjs
run 01b-f8-filter-5198 PORT=5198 node r10-01b-f8-filter.mjs
run r9-12-f8flow PORT=5176 node r10-r9-12-f8flow.mjs
run 09-dialog-digits-5176 PORT=5176 node r10-09-dialog-digits.mjs
run 16-deselect-arrow-5176 PORT=5176 node r10-16-deselect-arrow.mjs
run 04-twotab-5176 PORT=5176 node r10-04-twotab.mjs
run 02-arrows-5176 PORT=5176 node r10-02-arrows.mjs
run 10b-storage-paste-5176 PORT=5176 node r10-10b-storage-paste.mjs
run 10-storage-full-5176 PORT=5176 node r10-10-storage-full.mjs
run 05-undo-reload-5176 PORT=5176 node r10-05-undo-reload.mjs
run 07-json-import-5176 PORT=5176 node r10-07-json-import.mjs
run 07b-json-values PORT=5176 node r10-07b-json-values.mjs
run 08-files7 PORT=5176 node r10-08-files7.mjs
run r9-34-files6 PORT=5176 node r10-r9-34-files6.mjs
run r9-33-fix-leave PORT=5176 node r10-r9-33-fix-leave.mjs
run 15-sequence-5176 PORT=5176 node r10-15-sequence.mjs
echo DONE >> batch1.status
