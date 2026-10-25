cd /home/user/BOM/usertest/veteran/r23
run() { local name=$1; shift; nice -n 6 env "$@" > "$name.rerun.log" 2>&1; echo "$name exit $?" >> rerunS.status; }
: > rerunS.status
run 10-storage-full-5176 PORT=5176 node r11-10-storage-full.mjs
run 04-twotab-5176 PORT=5176 node r11-04-twotab.mjs
run 69-reload-r13 node r13-69-reload-r13.mjs
run 85b-json-protoid-run1 PORT=5176 RUN=-run1 node 85b-json-protoid.mjs
run 92-storage-publish-run1 PORT=5176 RUN=-run1 node 92-storage-publish.mjs
run 103-twotab-undo-run1 PORT=5176 RUN=-run1 node 103-twotab-undo.mjs
run 23-norow-keys-5176 PORT=5176 node r11-23-norow-keys.mjs
run 21-f2-modes-5176 PORT=5176 node r11-21-f2-modes.mjs
run 08-files7 PORT=5176 node r11-08-files7.mjs
echo DONE >> rerunS.status
