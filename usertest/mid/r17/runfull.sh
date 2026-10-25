#!/bin/bash
cd /home/user/BOM/usertest/mid/r17
./runreg.sh
./rund.sh > out/rund.log 2>&1
./runf.sh > out/runf.log 2>&1
run() { local f=$1; local o=$2; shift 2; timeout 600 node $f.mjs "$@" > out/$o.out 2>&1; echo "$o $(tail -1 out/$o.out)"; }
( run g1 g1-designated designated; run g1 g1-supply supply; run g2 g2; run g3 g3-adopted adopted ) &
( run g3 g3-reselect reselect; run g3 g3-quoted quoted; run g4 g4; run g5 g5-fixrev fixrev ) &
( run g5 g5-reject reject; run g5 g5-due due; run g6 g6-requote requote; run g6 g6-model model ) &
( run g7 g7-record record; run g7 g7-minlot minlot; run g7 g7-ltb ltb; run g8 g8-tabs tabs; run g8 g8-wipcheck wipcheck ) &
wait
echo FULLDONE > out/full.done
