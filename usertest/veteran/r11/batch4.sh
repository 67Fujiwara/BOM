#!/bin/bash
cd /home/user/BOM/usertest/veteran/r11
run() { local name=$1; shift; echo "== $name $(date +%T)" >> batch4.status; env "$@" > "$name.log" 2>&1; echo "   exit $? $(date +%T)" >> batch4.status; }
run 24b-storage-actions2-5176 PORT=5176 node 24b-storage-actions2.mjs
run 29-json-new-5176 PORT=5176 node 29-json-new.mjs
run r9-37-mac-option-nav PORT=5176 node r10-r9-37-mac-option-nav.mjs
run r9-38-misc-keys PORT=5176 node r10-r9-38-misc-keys.mjs
run r9-r8-25-ime PORT=5176 node r10-r9-r8-25-ime.mjs
run 11-f1-ctrlf-inputs-5176 PORT=5176 node r10-11-f1-ctrlf-inputs.mjs
run 12-reload-odd-5176 PORT=5176 node r10-12-reload-odd.mjs
run 17-palette-exact-5176 PORT=5176 node r10-17-palette-exact.mjs
run r9-36-undo-chain PORT=5176 node r10-r9-36-undo-chain.mjs
run r9-30-norow-symbols PORT=5176 node r10-r9-30-norow-symbols.mjs
run r9-r8-23-norow-digits PORT=5176 node r10-r9-r8-23-norow-digits.mjs
run r9-31-norow-keys PORT=5176 node r10-r9-31-norow-keys.mjs
run r9-32-twotab2 PORT=5176 node r10-r9-32-twotab2.mjs
run r9-40-twotab3 PORT=5176 node r10-r9-40-twotab3.mjs
run r9-r8-15-twotab PORT=5176 node r10-r9-r8-15-twotab.mjs
run 03-entry-matrix-5176 PORT=5176 node r10-03-entry-matrix.mjs
run 13-alt-sweep-5176 PORT=5176 node r10-13-alt-sweep.mjs
echo DONE >> batch4.status
