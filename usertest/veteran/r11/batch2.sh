#!/bin/bash
cd /home/user/BOM/usertest/veteran/r11
run() { local name=$1; shift; echo "== $name $(date +%T) load=$(cut -d' ' -f1-3 /proc/loadavg)" >> batch2.status; env "$@" > "$name.log" 2>&1; echo "   exit $? $(date +%T)" >> batch2.status; }
run 13-latency-ab-2500 TAG=-2500 SIZE=2500 node r10-r9-13-latency-ab.mjs
run 13-latency-ab-300 TAG=-300 SIZE=300 MODES=plain,holidays node r10-r9-13-latency-ab.mjs
run 06-regex-budget PORTS=5197,5198 node r10-06-regex-budget.mjs
echo DONE >> batch2.status
