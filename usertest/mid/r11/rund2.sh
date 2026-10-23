#!/bin/bash
cd /home/user/BOM/usertest/mid/r11
run() { local f=$1; local o=$2; shift 2; timeout 600 node $f.mjs "$@" > out/$o.out 2>&1; echo "$o $(tail -1 out/$o.out)"; }
( run d1 d1-remove-run2 remove; run d1 d1-tradable-run2 tradable; run d2 d2-fail-run2 fail b ) &
( run d2 d2-q-run2 q; run d2 d2-g-run2 g; run d4 d4-run2 ) &
( run d3 d3-main-run2 main b; run d3 d3-formal-run2 formal; run d5 d5-run2 ) &
wait; echo DONE
