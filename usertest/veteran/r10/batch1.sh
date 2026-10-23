#!/bin/bash
cd /home/user/BOM/usertest/veteran/r10
for f in r9-33-fix-leave r9-37-mac-option-nav r9-38-misc-keys r9-34-files6 r9-30-norow-symbols r9-r8-10-uneditable-digits r9-r8-10b-other-row r9-36-undo-chain r9-32-twotab2 r9-40-twotab3 r9-r8-15-twotab r9-r8-23-norow-digits r9-r8-11-alt-symbol-f1 r9-r8-21-files5 r9-31-norow-keys; do
  echo "== $f $(date +%T)" >> batch1.status
  PORT=5176 timeout 900 node $f.mjs > $f.log 2>&1; echo "rc=$? $(date +%T)" >> batch1.status
done
echo DONE >> batch1.status
