#!/bin/bash
cd /home/user/BOM/usertest/veteran/r20
run() { local name=$1; shift; echo "== $name $(date +%T) load=$(cut -d' ' -f1-3 /proc/loadavg)" >> batchU.status; nice -n 5 env "$@" > "$name.log" 2>&1; echo "   exit $? $(date +%T)" >> batchU.status; }
K='Control+r,Control+Shift+r,Control+Minus,Control+NumpadSubtract,Control+NumpadAdd,Control+Shift+Equal,Control+Shift+Minus,Control+Alt+r,Control+Digit0'
run 141k-linux PORT=5176 PLAT=linux RUN=-k2 KEYS=$K node 141-excel-keys.mjs
run 141k-linux-5198 PORT=5198 PLAT=linux RUN=-k2 KEYS=$K node 141-excel-keys.mjs
run 141k-mac PORT=5176 PLAT=mac RUN=-k2 KEYS=Meta+r,Meta+Minus,Meta+Shift+r,Control+r,Control+Minus,Meta+NumpadSubtract node 141-excel-keys.mjs
echo DONE >> batchU.status
