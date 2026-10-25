#!/bin/bash
cd /home/user/BOM/usertest/veteran/r21
run() { local name=$1; shift; echo "== $name $(date +%T) load=$(cut -d' ' -f1-3 /proc/loadavg)" >> sweep.status; nice -n 8 env "$@" > "$name.log" 2>&1; echo "   exit $? $(date +%T)" >> sweep.status; }
run 16-deselect-arrow-5176 PORT=5176 node r11-16-deselect-arrow.mjs
run 12-reload-odd-5176 PORT=5176 node r11-12-reload-odd.mjs
run 11-f1-ctrlf-inputs-5176 PORT=5176 node r11-11-f1-ctrlf-inputs.mjs
run 24b-storage-actions2-5176 PORT=5176 node r11-24b-storage-actions2.mjs
run 25-undo200-5176 PORT=5176 node r11-25-undo200.mjs
run 26-twotab-new-5176 PORT=5176 node r11-26-twotab-new.mjs
run 07-json-import-5176 PORT=5176 node r11-07-json-import.mjs
run 41b-norow-ctrl-5176 PORT=5176 node r12-41b-norow-ctrl.mjs
run 66-paste-r13-5176 PORT=5176 node r13-66-paste-r13.mjs
run 64-json-r13-5176 PORT=5176 node r13-64-json-r13.mjs
run 68-storage-r13-5176 PORT=5176 node r13-68-storage-r13.mjs
run 71-numpad-roles-5176 PORT=5176 node r13-71-numpad-roles.mjs
run 85-json-r14-run1 PORT=5176 RUN=-run1 node 85-json-r14.mjs
run 90-dialog-r14-run1 PORT=5176 RUN=-run1 node 90-dialog-r14.mjs
run 98-f8-anchor-run1 PORT=5176 RUN=-run1 node 98-f8-anchor.mjs
run 101-misc-r15-run1 PORT=5176 RUN=-run1 node 101-misc-r15.mjs
run 111-mac-ctrl-mac-run1 PORT=5176 PLAT=mac RUN=-run1 node 111-mac-ctrl.mjs
run 114-mac-ctrl-typed-mac-run1 PORT=5176 PLAT=mac RUN=-run1 node 114-mac-ctrl-typed.mjs
run 121-normalize-crash-run1 PORT=5176 RUN=-run1 node 121-normalize-crash.mjs
run 127-deep-nest-run1 PORT=5176 RUN=-run1 node 127-deep-nest.mjs
run 134-grid-paste-ml-5176-run1 PORT=5176 RUN=-run1 node 134-grid-paste-ml.mjs
run 141-excel-keys-mac-run1 PORT=5176 PLAT=mac RUN=-run1 node 141-excel-keys.mjs
run 145-needdate-year-run1 PORT=5176 RUN=-run1 node 145-needdate-year.mjs
run 137-render-ui-run1 PORT=5176 RUN=-run1 node 137-render-ui.mjs
echo lane2 >> sweepL.done
