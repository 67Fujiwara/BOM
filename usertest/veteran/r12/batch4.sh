#!/bin/bash
cd /home/user/BOM/usertest/veteran/r12
until grep -q DONE batch3.status 2>/dev/null; do sleep 5; done
run() { local name=$1; shift; echo "== $name $(date +%T) load=$(cut -d' ' -f1-3 /proc/loadavg)" >> batch4.status; env "$@" > "$name.log" 2>&1; echo "   exit $? $(date +%T) load=$(cut -d' ' -f1-3 /proc/loadavg)" >> batch4.status; }
run 13-latency-ab-2500b TAG=-2500b SIZE=2500 node r11-r9-13-latency-ab.mjs
run 13-latency-ab-300b TAG=-300b SIZE=300 MODES=plain,holidays node r11-r9-13-latency-ab.mjs
run 28-latency-new-b TAG=-b node r11-28-latency-new.mjs
run 14-typed-arrow-latency-5197b PORT=5197 node r11-14-typed-arrow-latency.mjs
run 14-typed-arrow-latency-5198b PORT=5198 node r11-14-typed-arrow-latency.mjs
echo DONE >> batch4.status
