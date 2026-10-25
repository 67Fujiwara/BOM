#!/bin/bash
cd /home/user/BOM/usertest/veteran/r21
run() { local name=$1; shift; echo "== $name $(date +%T) load=$(cut -d' ' -f1-3 /proc/loadavg)" >> sweep.status; nice -n 8 env "$@" > "$name.log" 2>&1; echo "   exit $? $(date +%T)" >> sweep.status; }
run 23-norow-keys-5176 PORT=5176 node r11-23-norow-keys.mjs
run 21-f2-modes-5176 PORT=5176 node r11-21-f2-modes.mjs
run r9-30-norow-symbols PORT=5176 node r11-r9-30-norow-symbols.mjs
run 24-storage-actions-5176 PORT=5176 node r11-24-storage-actions.mjs
run 10b-storage-paste-5176 PORT=5176 node r11-10b-storage-paste.mjs
run r9-36-undo-chain PORT=5176 node r11-r9-36-undo-chain.mjs
run r9-40-twotab3 PORT=5176 node r11-r9-40-twotab3.mjs
run 08-files7 PORT=5176 node r11-08-files7.mjs
run 48-paste-new-5176 PORT=5176 node r12-48-paste-new.mjs
run 63-dialog-r13-5176 PORT=5176 node r13-63-dialog-r13.mjs
run 67b-undo-publish-5176 PORT=5176 node r13-67b-undo-publish.mjs
run 70-misc-r13-5176 PORT=5176 node r13-70-misc-r13.mjs
run 84-undo-publish2-run1 PORT=5176 RUN=-run1 node 84-undo-publish2.mjs
run 86-f8-r14-run1 PORT=5176 RUN=-run1 node 86-f8-r14.mjs
run 93-misc-r14-run1 PORT=5176 RUN=-run1 node 93-misc-r14.mjs
run 100-json-r15-run1 PORT=5176 RUN=-run1 node 100-json-r15.mjs
run 110-undo-publish4-run1 PORT=5176 RUN=-run1 node 110-undo-publish4.mjs
run 113-dup-tab-run1 PORT=5176 RUN=-run1 node 113-dup-tab.mjs
run 114-mac-ctrl-typed-linux PORT=5176 PLAT=linux node 114-mac-ctrl-typed.mjs
run 125-json-r17-run1 PORT=5176 RUN=-run1 node 125-json-r17.mjs
run 133-withdrawn-x-run1 PORT=5176 RUN=-run1 node 133-withdrawn-x.mjs
run 141-excel-keys-linux-run1 PORT=5176 PLAT=linux RUN=-run1 node 141-excel-keys.mjs
run 143-twotab-decision-run1 PORT=5176 RUN=-run1 node 143-twotab-decision.mjs
run 148-twotab-settings-confirm-run1 PORT=5176 RUN=-run1 node 148-twotab-settings-confirm.mjs
echo lane1 >> sweepL.done
