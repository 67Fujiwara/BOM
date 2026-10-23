#!/bin/bash
# usage: run-chain.sh name script...
cd /home/user/BOM/usertest/veteran/r8/rerun7
export BOM_URL=http://localhost:5176/
for s in "$@"; do
  b=$(basename $s .mjs); d=$(dirname $s)
  echo "=== $(date +%T) start $s" >> chain.log
  (cd $d && timeout 1800 node $(basename $s) > $b.log 2>&1); echo "=== $(date +%T) end $s rc=$?" >> chain.log
done
