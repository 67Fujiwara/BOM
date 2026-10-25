#!/bin/bash
cd /home/user/BOM/usertest/mid/r18
run() { local f=$1; local o=$2; shift 2; timeout 600 node $f.mjs "$@" > out/$o.out 2>&1; echo "$o $(tail -1 out/$o.out)"; }
( run f1 f1; run f2 f2; run f2b f2b; run f3 f3; run f3b f3b ) &
( run f4 f4; run f5 f5; run f5b f5b; run f7 f7; run f8 f8 ) &
( run f9 f9; run f10 f10; run f11 f11; run e1 e1-remove remove; run e1 e1-rule rule; run e2 e2 ) &
( run e3 e3; run e4 e4; run e5 e5; run e6 e6; run e7 e7; run e8 e8 ) &
wait; echo DONE
