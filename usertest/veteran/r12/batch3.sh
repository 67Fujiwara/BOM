#!/bin/bash
cd /home/user/BOM/usertest/veteran/r12
until grep -q DONE batch2.status 2>/dev/null; do sleep 5; done
run() { local name=$1; shift; echo "== $name $(date +%T) load=$(cut -d' ' -f1-3 /proc/loadavg)" >> batch3.status; env "$@" > "$name.log" 2>&1; echo "   exit $? $(date +%T)" >> batch3.status; }
run 78-paste-5197 PORT=5197 node r11-r9-78-paste.mjs
run 78-paste-5198 PORT=5198 node r11-r9-78-paste.mjs
run 40-f8-cursor-5198 PORT=5198 node 40-f8-cursor.mjs
run r9-40-twotab3 PORT=5176 node r11-r9-40-twotab3.mjs
run r9-30-norow-symbols PORT=5176 node r11-r9-30-norow-symbols.mjs
run 11-f1-ctrlf-inputs-5176 PORT=5176 node r11-11-f1-ctrlf-inputs.mjs
echo DONE >> batch3.status
