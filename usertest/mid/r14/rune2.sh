#!/bin/bash
cd /home/user/BOM/usertest/mid/r14
run() { local f=$1; local o=$2; shift 2; timeout 600 node $f.mjs "$@" > out/$o.out 2>&1; echo "$o $(tail -1 out/$o.out)"; }
( run e1 e1-remove-run2 remove; run e2 e2-run2; run e3 e3-run2 ) &
( run e4 e4-run2; run e5 e5-run2; run d2 d2-q-run2 q ) &
( run e6 e6-run2; run e7 e7-run2; run e8 e8-run2 ) &
wait; echo DONE
