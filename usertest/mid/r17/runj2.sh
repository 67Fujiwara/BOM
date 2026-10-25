#!/bin/bash
cd /home/user/BOM/usertest/mid/r17
run() { local f=$1; local o=$2; shift 2; timeout 600 node $f.mjs "$@" > out/$o.out 2>&1; echo "$o $(tail -1 out/$o.out)"; }
run j1 j1-run2
run j2 j2-run2
run j4 j4-run2
run j5 j5-run2
run j6 j6-run2
run j7 j7-samefield-run2 samefield
run j11 j11-run2
run j12 j12-run2
run i4 i4-run2
run i7 i7-multi-run2 multi
run j9 j9-run2
echo DONE
