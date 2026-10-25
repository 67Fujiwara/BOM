#!/bin/bash
cd /home/user/BOM/usertest/mid/r17
run() { local f=$1; local o=$2; shift 2; timeout 600 node $f.mjs "$@" > out/$o.out 2>&1; echo "$o $(tail -1 out/$o.out)"; }
( run i1 i1; run i2 i2; run i3 i3; run i4 i4; run i5 i5-sel sel; run i5 i5-quoted quoted ) &
( run i5 i5-reject reject; run i6 i6; run i7 i7-approve approve; run i7 i7-multi multi; run i7 i7-ack ack; run i8 i8; run i9 i9-supplyreq supplyreq; run i9 i9-partial partial ) &
wait; echo DONE
