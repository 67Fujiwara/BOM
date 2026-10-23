#!/bin/bash
cd /home/user/BOM/usertest/mid/r14
run() { local f=$1; local o=$2; shift 2; timeout 600 node $f.mjs "$@" > out/$o.out 2>&1; echo "$o $(tail -1 out/$o.out)"; }
run g1 g1-supply-run2 supply
run g2 g2-run2
run g3 g3-adopted-run2 adopted
run g3 g3-reselect-run2 reselect
run g3 g3-quoted-run2 quoted
run g5 g5-fixrev-run2 fixrev
run g5 g5-reject-run2 reject
run g5 g5-due-run2 due
run g6 g6-requote-run2 requote
run g6 g6-model-run2 model
run g7 g7-record-run2 record
run g7 g7-minlot-run2 minlot
run g8 g8-wipcheck-run2 wipcheck
echo DONE
