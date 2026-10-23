#!/bin/bash
cd /home/user/BOM/usertest/mid/r14
run() { local f=$1; local o=$2; shift 2; timeout 600 node $f.mjs "$@" > out/$o.out 2>&1; echo "$o $(tail -1 out/$o.out)"; }
( run d1 d1-remove remove; run d1 d1-tradable tradable; run d2 d2-fail fail; run d2 d2-fail-b fail b ) &
( run d2 d2-q q; run d2 d2-g g; run d4 d4; run d5 d5 ) &
( run d3 d3-main main; run d3 d3-main-b main b; run d3 d3-formal formal ) &
wait; echo DONE
