#!/bin/bash
# 反応時間 A/B（r20 ビルド 5198 / 現行 5197）。総当たり（sweepL）の後で
cd /home/user/BOM/usertest/veteran/r21
while ! grep -q DONE batchK.status 2>/dev/null; do sleep 15; done
run() { local name=$1; shift; echo "== $name $(date +%T) load=$(cut -d' ' -f1-3 /proc/loadavg)" >> batchL.status; env "$@" > "$name.log" 2>&1; echo "   exit $? $(date +%T)" >> batchL.status; }
run 13-latency-ab-2500 TAG=-2500 SIZE=2500 node r11-r9-13-latency-ab.mjs
run 13-latency-ab-300 TAG=-300 SIZE=300 MODES=plain,holidays node r11-r9-13-latency-ab.mjs
run 78-paste-5197 PORT=5197 node r11-r9-78-paste.mjs
run 78-paste-5198 PORT=5198 node r11-r9-78-paste.mjs
run 174-flagged-latency-5197 BOM_URL=http://localhost:5197/ RUN=-5197 node 174-flagged-latency.mjs
run 174-flagged-latency-5198 BOM_URL=http://localhost:5198/ RUN=-5198 node 174-flagged-latency.mjs
echo DONE >> batchL.status
