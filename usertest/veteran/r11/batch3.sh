#!/bin/bash
cd /home/user/BOM/usertest/veteran/r11
run() { local name=$1; shift; echo "== $name $(date +%T) load=$(cut -d' ' -f1-3 /proc/loadavg)" >> batch3.status; env "$@" > "$name.log" 2>&1; echo "   exit $? $(date +%T) load=$(cut -d' ' -f1-3 /proc/loadavg)" >> batch3.status; }
run 28-latency-new node 28-latency-new.mjs
run 13-latency-ab-2500b TAG=-2500b SIZE=2500 node r10-r9-13-latency-ab.mjs
run 13-latency-ab-300b TAG=-300b SIZE=300 MODES=plain,holidays node r10-r9-13-latency-ab.mjs
run 14-typed-arrow-latency-5197 PORT=5197 node r10-14-typed-arrow-latency.mjs
run 14-typed-arrow-latency-5198 PORT=5198 node r10-14-typed-arrow-latency.mjs
echo DONE >> batch3.status
