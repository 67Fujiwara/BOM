#!/bin/bash
cd /home/user/BOM/usertest/mid/r17
run() { local f=$1; local o=$2; shift 2; timeout 600 node $f.mjs "$@" > out/$o.out 2>&1; echo "$o $(tail -1 out/$o.out)"; }
run i2 i2-run2
run i3 i3-run2
run i4 i4-run2
run i5 i5-sel-run2 sel
run i5 i5-quoted-run2 quoted
run i7 i7-approve-run2 approve
run i7 i7-multi-run2 multi
run i9 i9-supplyreq-run2 supplyreq
run i9 i9-partial-run2 partial
echo DONE
