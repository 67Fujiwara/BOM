#!/bin/bash
cd /home/user/BOM/usertest/mid/r18
run() { local f=$1; local o=$2; shift 2; timeout 600 node $f.mjs "$@" > out/$o.out 2>&1; echo "$o $(tail -1 out/$o.out)"; }
( run k1 k1-run2; run k2 k2-run2; run k3 k3-run2; run k3b k3b-run2 ) &
( run k4 k4-reject-run2 reject; run k7 k7-approve-run2 approve; run k7 k7-reject-run2 reject ) &
( run k9 k9; run k9 k9-run2; run k12 k12-run2; run k6 k6-empty-run2 empty; run i4 i4-run2 ) &
wait; echo DONE
