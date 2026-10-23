#!/bin/bash
# ラウンド15: r13 の新規スクリプトを現行（5176）と r14 ビルド（5198, 3816376）で流し直す
cd /home/user/BOM/usertest/veteran/r15
while ! grep -q DONE batchS.status 2>/dev/null; do sleep 10; done
run() { local name=$1; shift; echo "== $name $(date +%T) load=$(cut -d' ' -f1-3 /proc/loadavg)" >> batchR.status; env "$@" > "$name.log" 2>&1; echo "   exit $? $(date +%T)" >> batchR.status; }
run 61-header-wizard node r13-61-header-wizard.mjs
run 61-header-wizard-5198 BOM_URL=http://localhost:5198/ TAG=-5198 node r13-61-header-wizard.mjs
run 65-excel-r13 node r13-65-excel-r13.mjs
run 65-excel-r13-5198 BOM_URL=http://localhost:5198/ TAG=-5198 node r13-65-excel-r13.mjs
run 66b-wizard-paste node r13-66b-wizard-paste.mjs
run 66b-wizard-paste-5198 BOM_URL=http://localhost:5198/ TAG=-5198 node r13-66b-wizard-paste.mjs
run 66-paste-r13-5176 PORT=5176 node r13-66-paste-r13.mjs
run 62-twotab-r13-5176 PORT=5176 node r13-62-twotab-r13.mjs
run 62-twotab-r13-5198 PORT=5198 node r13-62-twotab-r13.mjs
run 62-twotab-r13-5176-u PORT=5176 ONLY_U=1 node r13-62-twotab-r13.mjs
run 63-dialog-r13-5176 PORT=5176 node r13-63-dialog-r13.mjs
run 63-dialog-r13-5198 PORT=5198 node r13-63-dialog-r13.mjs
run 64-json-r13-5176 PORT=5176 node r13-64-json-r13.mjs
run 64-json-r13-5198 PORT=5198 node r13-64-json-r13.mjs
run 67-undo-r13-5176 PORT=5176 node r13-67-undo-r13.mjs
run 67b-undo-publish-5176 PORT=5176 node r13-67b-undo-publish.mjs
run 67b-undo-publish-5198 PORT=5198 node r13-67b-undo-publish.mjs
run 68-storage-r13-5176 PORT=5176 node r13-68-storage-r13.mjs
run 68-storage-r13-5176-b PORT=5176 PART2=1 node r13-68-storage-r13.mjs
run 69-reload-r13 node r13-69-reload-r13.mjs
run 70-misc-r13-5176 PORT=5176 node r13-70-misc-r13.mjs
run 71-numpad-roles-5176 PORT=5176 node r13-71-numpad-roles.mjs
echo DONE >> batchR.status
