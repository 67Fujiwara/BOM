#!/bin/bash
cd /home/user/BOM/usertest/veteran/r21
run() { local name=$1; shift; echo "== $name $(date +%T) load=$(cut -d' ' -f1-3 /proc/loadavg)" >> sweep.status; nice -n 8 env "$@" > "$name.log" 2>&1; echo "   exit $? $(date +%T)" >> sweep.status; }
run 17-palette-exact-5176 PORT=5176 node r11-17-palette-exact.mjs
run 02-arrows-5176 PORT=5176 node r11-02-arrows.mjs
run r9-38-misc-keys PORT=5176 node r11-r9-38-misc-keys.mjs
run r9-r8-25-ime PORT=5176 node r11-r9-r8-25-ime.mjs
run 10-storage-full-5176 PORT=5176 node r11-10-storage-full.mjs
run 05-undo-reload-5176 PORT=5176 node r11-05-undo-reload.mjs
run 04-twotab-5176 PORT=5176 node r11-04-twotab.mjs
run 07b-json-values PORT=5176 node r11-07b-json-values.mjs
run 50-fast-chain-5176 PORT=5176 node r12-50-fast-chain.mjs
run 62-twotab-r13-5176 PORT=5176 node r13-62-twotab-r13.mjs
run 67-undo-r13-5176 PORT=5176 node r13-67-undo-r13.mjs
run 69-reload-r13 node r13-69-reload-r13.mjs
run 83-twotab-publish-run1 PORT=5176 RUN=-run1 node 83-twotab-publish.mjs
run 85b-json-protoid-run1 PORT=5176 RUN=-run1 node 85b-json-protoid.mjs
run 92-storage-publish-run1 PORT=5176 RUN=-run1 node 92-storage-publish.mjs
run 99-undo-publish3-run1 PORT=5176 RUN=-run1 node 99-undo-publish3.mjs
run 103-twotab-undo-run1 PORT=5176 RUN=-run1 node 103-twotab-undo.mjs
run 112-json-r16-run1 PORT=5176 RUN=-run1 node 112-json-r16.mjs
run 111-mac-ctrl-linux PORT=5176 PLAT=linux node 111-mac-ctrl.mjs
run 123-undo-publish5-run1 PORT=5176 RUN=-run1 node 123-undo-publish5.mjs
run 129-json-r18-run1 PORT=5176 RUN=-run1 node 129-json-r18.mjs
run 139-needoffset-ui-run1 PORT=5176 RUN=-run1 node 139-needoffset-ui.mjs
run 142-json-r19-run1 PORT=5176 RUN=-run1 node 142-json-r19.mjs
run 147-grid-paste-inch-run1 PORT=5176 RUN=-run1 node 147-grid-paste-inch.mjs
echo lane0 >> sweepL.done
