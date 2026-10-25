#!/bin/bash
# ラウンド19 の新規手順の続き（148 × 2 回目＋r18 ビルド、MQ16 は 140 に足したので 140 の直接呼び出しを流し直し済み）
cd /home/user/BOM/usertest/veteran/r20
while ! grep -q DONE batchX.status 2>/dev/null; do sleep 10; done
run() { local name=$1; shift; echo "== $name $(date +%T) load=$(cut -d' ' -f1-3 /proc/loadavg)" >> batchY.status; env "$@" > "$name.log" 2>&1; echo "   exit $? $(date +%T)" >> batchY.status; }
run 148-twotab-settings-confirm-run2 PORT=5176 RUN=-run2 node 148-twotab-settings-confirm.mjs
run 148-twotab-settings-confirm-5198 PORT=5198 node 148-twotab-settings-confirm.mjs
echo DONE >> batchY.status
