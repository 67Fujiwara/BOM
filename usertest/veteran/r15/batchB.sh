#!/bin/bash
cd /home/user/BOM/usertest/veteran/r15
while ! grep -q DONE batchA.status; do sleep 10; done
run() { local name=$1; shift; echo "== $name $(date +%T) load=$(cut -d' ' -f1-3 /proc/loadavg)" >> batchB.status; env "$@" > "$name.log" 2>&1; echo "   exit $? $(date +%T)" >> batchB.status; }
run 13-alt-sweep-5176 PORT=5176 node r11-13-alt-sweep.mjs
run 03-entry-matrix-5176 PORT=5176 node r11-03-entry-matrix.mjs
run 17-palette-exact-5176 PORT=5176 node r11-17-palette-exact.mjs
run 23-norow-keys-5176 PORT=5176 node r11-23-norow-keys.mjs
run 16-deselect-arrow-5176 PORT=5176 node r11-16-deselect-arrow.mjs
run 02-arrows-5176 PORT=5176 node r11-02-arrows.mjs
run 21-f2-modes-5176 PORT=5176 node r11-21-f2-modes.mjs
run 12-reload-odd-5176 PORT=5176 node r11-12-reload-odd.mjs
run r9-38-misc-keys PORT=5176 node r11-r9-38-misc-keys.mjs
run r9-30-norow-symbols PORT=5176 node r11-r9-30-norow-symbols.mjs
run 11-f1-ctrlf-inputs-5176 PORT=5176 node r11-11-f1-ctrlf-inputs.mjs
run r9-r8-25-ime PORT=5176 node r11-r9-r8-25-ime.mjs
run 24-storage-actions-5176 PORT=5176 node r11-24-storage-actions.mjs
run 24b-storage-actions2-5176 PORT=5176 node r11-24b-storage-actions2.mjs
run 10-storage-full-5176 PORT=5176 node r11-10-storage-full.mjs
run 10b-storage-paste-5176 PORT=5176 node r11-10b-storage-paste.mjs
run 25-undo200-5176 PORT=5176 node r11-25-undo200.mjs
run 05-undo-reload-5176 PORT=5176 node r11-05-undo-reload.mjs
run r9-36-undo-chain PORT=5176 node r11-r9-36-undo-chain.mjs
run 26-twotab-new-5176 PORT=5176 node r11-26-twotab-new.mjs
run 04-twotab-5176 PORT=5176 node r11-04-twotab.mjs
run r9-40-twotab3 PORT=5176 node r11-r9-40-twotab3.mjs
run 07-json-import-5176 PORT=5176 node r11-07-json-import.mjs
run 07b-json-values PORT=5176 node r11-07b-json-values.mjs
run 08-files7 PORT=5176 node r11-08-files7.mjs
run 41b-norow-ctrl-5176 PORT=5176 node r12-41b-norow-ctrl.mjs
run 50-fast-chain-5176 PORT=5176 node r12-50-fast-chain.mjs
run 48-paste-new-5176 PORT=5176 node r12-48-paste-new.mjs
echo DONE >> batchB.status
