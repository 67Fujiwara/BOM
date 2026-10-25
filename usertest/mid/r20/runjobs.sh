#!/bin/bash
# usage: runjobs.sh jobsfile [parallel]  — 各行「スクリプト 出力名 引数…」を並列に流す
cd /home/user/BOM/usertest/mid/r20
one() { set -- $1; local f=$1 o=$2; shift 2; timeout 600 node $f.mjs "$@" > out/$o.out 2>&1; echo "$o $(tail -1 out/$o.out)"; }
export -f one
grep -v '^#' "$1" | grep . | xargs -P ${2:-4} -I{} bash -c 'one "{}"'
echo DONE
