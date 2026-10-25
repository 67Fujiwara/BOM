#!/bin/bash
# ラウンド20: r19 までの手順の総当たり（現行 5176 のみ、2 回あるものは run1 だけ）。結果は r19 の同名の .log と突き合わせる（146-diff-r19.mjs）
cd /home/user/BOM/usertest/veteran/r20
run() { local name=$1; shift; echo "== $name $(date +%T) load=$(cut -d' ' -f1-3 /proc/loadavg)" >> sweep.status; nice -n 8 env "$@" > "$name.log" 2>&1; echo "   exit $? $(date +%T)" >> sweep.status; }
run 132-big18-make node 132-big18-make.mjs
run 124-big17-make node 124-big17-make.mjs
run 144-big19-make node 144-big19-make.mjs
run 128-header-wizard node 128-header-wizard.mjs
run 132-big18 node 132-big18.mjs
run 144-big19 node 144-big19.mjs
run 122-header-wizard node 122-header-wizard.mjs
run 124-big17 node 124-big17.mjs
run 107-header-wizard node 107-header-wizard.mjs
run 108-xlsx-r16 node 108-xlsx-r16.mjs
run 109-wizard-paste-r16 node 109-wizard-paste-r16.mjs
run 81-header-wizard node 81-header-wizard.mjs
run 82-excel-big node 82-excel-big.mjs
run 89-ecn-xlsx node 89-ecn-xlsx.mjs
run 87-roundtrip node 87-roundtrip.mjs
run 88-wizard-stale node 88-wizard-stale.mjs
run 91-twotab-wizard node 91-twotab-wizard.mjs
run 96-header-wizard node 96-header-wizard.mjs
run 97-xlsx-r15 node 97-xlsx-r15.mjs
run 104-header-wizard node 104-header-wizard.mjs
run 61-header-wizard node r13-61-header-wizard.mjs
run 65-excel-r13 node r13-65-excel-r13.mjs
run 66b-wizard-paste node r13-66b-wizard-paste.mjs
run 41-norow-view-5176 PORT=5176 node r12-41-norow-view.mjs
run 47-excel-new BOM_URL=http://localhost:5176/ node r12-47-excel-new.mjs
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
run 66-paste-r13-5176 PORT=5176 node r13-66-paste-r13.mjs
run 62-twotab-r13-5176 PORT=5176 node r13-62-twotab-r13.mjs
run 63-dialog-r13-5176 PORT=5176 node r13-63-dialog-r13.mjs
run 64-json-r13-5176 PORT=5176 node r13-64-json-r13.mjs
run 67-undo-r13-5176 PORT=5176 node r13-67-undo-r13.mjs
run 67b-undo-publish-5176 PORT=5176 node r13-67b-undo-publish.mjs
run 68-storage-r13-5176 PORT=5176 node r13-68-storage-r13.mjs
run 69-reload-r13 node r13-69-reload-r13.mjs
run 70-misc-r13-5176 PORT=5176 node r13-70-misc-r13.mjs
run 71-numpad-roles-5176 PORT=5176 node r13-71-numpad-roles.mjs
run 83-twotab-publish-run1 PORT=5176 RUN=-run1 node 83-twotab-publish.mjs
run 84-undo-publish2-run1 PORT=5176 RUN=-run1 node 84-undo-publish2.mjs
run 85-json-r14-run1 PORT=5176 RUN=-run1 node 85-json-r14.mjs
run 85b-json-protoid-run1 PORT=5176 RUN=-run1 node 85b-json-protoid.mjs
run 86-f8-r14-run1 PORT=5176 RUN=-run1 node 86-f8-r14.mjs
run 90-dialog-r14-run1 PORT=5176 RUN=-run1 node 90-dialog-r14.mjs
run 92-storage-publish-run1 PORT=5176 RUN=-run1 node 92-storage-publish.mjs
run 93-misc-r14-run1 PORT=5176 RUN=-run1 node 93-misc-r14.mjs
run 98-f8-anchor-run1 PORT=5176 RUN=-run1 node 98-f8-anchor.mjs
run 99-undo-publish3-run1 PORT=5176 RUN=-run1 node 99-undo-publish3.mjs
run 100-json-r15-run1 PORT=5176 RUN=-run1 node 100-json-r15.mjs
run 101-misc-r15-run1 PORT=5176 RUN=-run1 node 101-misc-r15.mjs
run 103-twotab-undo-run1 PORT=5176 RUN=-run1 node 103-twotab-undo.mjs
run 110-undo-publish4-run1 PORT=5176 RUN=-run1 node 110-undo-publish4.mjs
run 111-mac-ctrl-mac-run1 PORT=5176 PLAT=mac RUN=-run1 node 111-mac-ctrl.mjs
run 112-json-r16-run1 PORT=5176 RUN=-run1 node 112-json-r16.mjs
run 113-dup-tab-run1 PORT=5176 RUN=-run1 node 113-dup-tab.mjs
run 114-mac-ctrl-typed-mac-run1 PORT=5176 PLAT=mac RUN=-run1 node 114-mac-ctrl-typed.mjs
run 111-mac-ctrl-linux PORT=5176 PLAT=linux node 111-mac-ctrl.mjs
run 114-mac-ctrl-typed-linux PORT=5176 PLAT=linux node 114-mac-ctrl-typed.mjs
run 121-normalize-crash-run1 PORT=5176 RUN=-run1 node 121-normalize-crash.mjs
run 123-undo-publish5-run1 PORT=5176 RUN=-run1 node 123-undo-publish5.mjs
run 125-json-r17-run1 PORT=5176 RUN=-run1 node 125-json-r17.mjs
run 127-deep-nest-run1 PORT=5176 RUN=-run1 node 127-deep-nest.mjs
run 129-json-r18-run1 PORT=5176 RUN=-run1 node 129-json-r18.mjs
run 133-withdrawn-x-run1 PORT=5176 RUN=-run1 node 133-withdrawn-x.mjs
run 134-grid-paste-ml-5176-run1 PORT=5176 RUN=-run1 node 134-grid-paste-ml.mjs
run 139-needoffset-ui-run1 PORT=5176 RUN=-run1 node 139-needoffset-ui.mjs
run 141-excel-keys-linux-run1 PORT=5176 PLAT=linux RUN=-run1 node 141-excel-keys.mjs
run 141-excel-keys-mac-run1 PORT=5176 PLAT=mac RUN=-run1 node 141-excel-keys.mjs
run 142-json-r19-run1 PORT=5176 RUN=-run1 node 142-json-r19.mjs
run 143-twotab-decision-run1 PORT=5176 RUN=-run1 node 143-twotab-decision.mjs
run 145-needdate-year-run1 PORT=5176 RUN=-run1 node 145-needdate-year.mjs
run 147-grid-paste-inch-run1 PORT=5176 RUN=-run1 node 147-grid-paste-inch.mjs
run 148-twotab-settings-confirm-run1 PORT=5176 RUN=-run1 node 148-twotab-settings-confirm.mjs
run 137-render-ui-run1 PORT=5176 RUN=-run1 node 137-render-ui.mjs
echo DONE >> sweep.status
