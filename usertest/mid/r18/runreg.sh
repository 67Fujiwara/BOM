#!/bin/bash
cd /home/user/BOM/usertest/mid/r18
(./runall.sh "v1 v1b v2 v3 v4 v5 v6 v7 v8 v9 v10 v11" ) > out/runreg1.log 2>&1 &
(./runall.sh "w1 w2 w3 w4 w5 w6 w7 w8 x1 x1on x1reorder x2 x3" ) > out/runreg2.log 2>&1 &
(./runall.sh "x4 x5 x6 x6b y1 y1b y1c y2 y3 y4 y5 y6 z1 z1b z2 z3 z3b z4" ) > out/runreg3.log 2>&1 &
(./runall.sh "a1 a2 a3 a3b a4 a5 a6 a7 a8" ) > out/runreg4.log 2>&1 &
wait
./runb.sh > out/runb.log 2>&1
./runc.sh > out/runc.log 2>&1
echo ALLDONE > out/reg.done
