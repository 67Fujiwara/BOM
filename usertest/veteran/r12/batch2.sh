#!/bin/bash
cd /home/user/BOM/usertest/veteran/r12
until grep -q DONE batch1.status; do sleep 5; done
run() { local name=$1; shift; echo "== $name $(date +%T) load=$(cut -d' ' -f1-3 /proc/loadavg)" >> batch2.status; env "$@" > "$name.log" 2>&1; echo "   exit $? $(date +%T) load=$(cut -d' ' -f1-3 /proc/loadavg)" >> batch2.status; }
run 13-latency-ab-2500 TAG=-2500 SIZE=2500 node r11-r9-13-latency-ab.mjs
run 13-latency-ab-300 TAG=-300 SIZE=300 MODES=plain,holidays node r11-r9-13-latency-ab.mjs
run 28-latency-new node r11-28-latency-new.mjs
run 14-typed-arrow-latency-5197 PORT=5197 node r11-14-typed-arrow-latency.mjs
run 14-typed-arrow-latency-5198 PORT=5198 node r11-14-typed-arrow-latency.mjs
run 03-entry-matrix-5176 PORT=5176 node r11-03-entry-matrix.mjs
run 13-alt-sweep-5176 PORT=5176 node r11-13-alt-sweep.mjs
run 05-undo-reload-5176 PORT=5176 node r11-05-undo-reload.mjs
run 12-reload-odd-5176 PORT=5176 node r11-12-reload-odd.mjs
run 17-palette-exact-5176 PORT=5176 node r11-17-palette-exact.mjs
run r9-36-undo-chain PORT=5176 node r11-r9-36-undo-chain.mjs
run r9-r8-25-ime PORT=5176 node r11-r9-r8-25-ime.mjs
run r9-38-misc-keys PORT=5176 node r11-r9-38-misc-keys.mjs
run 06-regex-budget PORTS=5197,5198 node r11-06-regex-budget.mjs
echo DONE >> batch2.status
