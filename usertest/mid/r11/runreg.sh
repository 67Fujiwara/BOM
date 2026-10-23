#!/bin/bash
cd /home/user/BOM/usertest/mid/r11
run() { local f=$1; local o=$2; shift 2; timeout 600 node $f.mjs "$@" > out/$o.out 2>&1; echo "$o $(tail -1 out/$o.out)"; }
lane() { for f in $1; do case $f in x1on) run x1 x1on on;; x1reorder) run x1 x1-reorder off reorder;; a1on) run a1 a1on on;; *) run $f $f;; esac; done; }
lane "v1 v10 v11 v1b v2 v3 v4 v5 v6 v7 v8 v9 a1 a1on" &
lane "w1 w2 w3 w4 w5 w6 w7 w8 x1 x1on x1reorder a2 a3" &
lane "x2 x3 x4 x5 x6 x6b y1 y1b y1c a3b a4 a5" &
lane "y2 y3 y4 y5 y6 z1 z1b z2 z3 z3b z4 a6 a7 a8" &
wait; echo DONE
