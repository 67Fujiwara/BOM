#!/bin/bash
# ラウンド16: dl の写し忘れで落ちた 87・88 の流し直しと、r14・r13 の見出しの形を 2 ビルドの src で直接（80・r13-60）
cd /home/user/BOM/usertest/veteran/r16
run() { local name=$1; shift; echo "== $name $(date +%T) load=$(cut -d' ' -f1-3 /proc/loadavg)" >> batchZ.status; env "$@" > "$name.log" 2>&1; echo "   exit $? $(date +%T)" >> batchZ.status; }
./probe.sh 80-header-probe.ts head >> batchZ.status
./probe.sh 80-header-probe.ts r15b >> batchZ.status
./probe.sh r13-60-header-unit.ts head >> batchZ.status
./probe.sh r13-60-header-unit.ts r15b >> batchZ.status
run 87-roundtrip node 87-roundtrip.mjs
run 88-wizard-stale node 88-wizard-stale.mjs
echo DONE >> batchZ.status
