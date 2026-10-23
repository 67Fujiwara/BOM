#!/bin/bash
cd /home/user/BOM/usertest/mid/r15
run() { local f=$1; local o=$2; shift 2; timeout 600 node $f.mjs "$@" > out/$o.out 2>&1; echo "$o $(tail -1 out/$o.out)"; }
( run c1 c1-all-run2 all; run c2b c2b-all-direct-run2 all direct; run c2b c2b-all-run2 all; run c3 c3-run2 ) &
( run c4 c4-run2; run c5 c5-run2; run c6 c6-run2; run c8 c8-run2; run c9 c9-run2 ) &
wait
run v7 v7; run v8 v8; run v6 v6
echo DONE
