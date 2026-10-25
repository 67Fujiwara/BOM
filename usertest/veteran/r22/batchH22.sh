#!/bin/bash
# 画面（UI）の再実行。現行 5176 と r20 ビルド 5176 で。run1（RUN=-run1）
cd /home/user/BOM/usertest/veteran/r22
r() { local name=$1; shift; echo "== $name $(date +%T) load=$(cut -d' ' -f1-3 /proc/loadavg)" >> batchH.status; timeout 900 nice -n 6 env "$@" > "$name.log" 2>&1; echo "   exit $? $(date +%T)" >> batchH.status; }
r 164-case-row-keys-5176 PORT=5176 RUN=-run1 node 164-case-row-keys.mjs
r 159-paste-trim-5176 PORT=5176 RUN=-run1 node 159-paste-trim.mjs
r 173-grid-paste-q-5176 PORT=5176 RUN=-run1 node 173-grid-paste-q.mjs
r 182-mac-option-case-5176 PORT=5176 RUN=-run1 node 182-mac-option-case.mjs
r 145-needdate-year-5176 PORT=5176 RUN=-run1 node 145-needdate-year.mjs
r 142-json-r19-5176 PORT=5176 RUN=-run1 node 142-json-r19.mjs
r 143-twotab-decision-5176 PORT=5176 RUN=-run1 node 143-twotab-decision.mjs
r 157-ui-misc-5176 PORT=5176 RUN=-run1 node 157-ui-misc.mjs
r 158-importdel-undo BOM_URL=http://localhost:5176/ RUN=-run1 node 158-importdel-undo.mjs
r 161-importdel-roles BOM_URL=http://localhost:5176/ RUN=-run1 node 161-importdel-roles.mjs
r 163-importdel-bulk-paste BOM_URL=http://localhost:5176/ RUN=-run1 node 163-importdel-bulk-paste.mjs
r 151b-importdel-fixloop BOM_URL=http://localhost:5176/ RUN=-run1 node 151b-importdel-fixloop.mjs
r 184-fix-burst BOM_URL=http://localhost:5176/ RUN=-run1 node 184-fix-burst.mjs
r 183-xlsx-strike-wizard BOM_URL=http://localhost:5176/ node 183-xlsx-strike-wizard.mjs
echo DONE >> batchH.status
