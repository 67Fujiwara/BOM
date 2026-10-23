#!/bin/bash
cd /home/user/BOM/usertest/mid/r14
run() { local f=$1; local o=$2; shift 2; timeout 600 node $f.mjs "$@" > out/$o.out 2>&1; echo "$o $(tail -1 out/$o.out)"; }
lane() { for f in $1; do case $f in a1on) run a1 a1on on;; *) run $f $f;; esac; done; }
lane "v10 v11 a1 a1on v1b" &
lane "w5 v4 a2 a3 w7" &
lane "v7 v8 a3b a4 a5 v5" &
lane "v9 v2 a6 a7 a8" &
wait; echo DONE
