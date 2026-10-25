#!/bin/bash
cd /home/user/BOM/usertest/mid/r18
run() { local f=$1; local o=$2; shift 2; timeout 600 node $f.mjs "$@" > out/$o.out 2>&1; echo "$o $(tail -1 out/$o.out)"; }
( run j1 j1; run j2 j2; run j3 j3; run j4 j4; run j5 j5 ) &
( run j6 j6; run j7 j7-samefield samefield; run j7 j7-reject reject; run j8 j8 ) &
( run j9 j9; run j10 j10; run j11 j11; run j12 j12; run j13 j13 ) &
wait; echo DONE
