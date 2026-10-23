#!/bin/bash
cd /home/user/BOM/usertest/mid/r13
run() { local f=$1; local o=$2; shift 2; timeout 600 node $f.mjs "$@" > out/$o.out 2>&1; echo "$o $(tail -1 out/$o.out)"; }
( run c1 c1-all all; run c1 c1-min2 min2; run c1 c1-deadline deadline; run c2 c2; run c2b c2b-all all; run c2b c2b-all-direct all direct ) &
( run c3 c3; run c4 c4; run c5 c5; run c6 c6; run c7 c7; run c8 c8; run c9 c9 ) &
wait; echo DONE
