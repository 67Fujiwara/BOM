#!/bin/bash
# 反応時間 A/B（r16 ビルド 5198 / 現行 5197）。batchB の後に流す
cd /home/user/BOM/usertest/veteran/r17
while ! grep -q DONE batchB.status 2>/dev/null || ! grep -q DONE batchR.status 2>/dev/null; do sleep 15; done
run() { local name=$1; shift; echo "== $name $(date +%T) load=$(cut -d' ' -f1-3 /proc/loadavg)" >> batchL.status; env "$@" > "$name.log" 2>&1; echo "   exit $? $(date +%T)" >> batchL.status; }
run 13-latency-ab-2500 TAG=-2500 SIZE=2500 node r11-r9-13-latency-ab.mjs
run 13-latency-ab-300 TAG=-300 SIZE=300 MODES=plain,holidays node r11-r9-13-latency-ab.mjs
run 28-latency-new TAG= node r11-28-latency-new.mjs
run 52-load-ab node r12-52-load-ab.mjs
run 14-typed-arrow-latency-5197 PORT=5197 node r11-14-typed-arrow-latency.mjs
run 14-typed-arrow-latency-5198 PORT=5198 node r11-14-typed-arrow-latency.mjs
run 78-paste-5197 PORT=5197 node r11-r9-78-paste.mjs
run 78-paste-5198 PORT=5198 node r11-r9-78-paste.mjs
run 06-regex-budget PORT=5197 node r11-06-regex-budget.mjs
echo DONE >> batchL.status
