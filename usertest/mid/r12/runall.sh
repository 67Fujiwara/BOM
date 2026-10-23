#!/bin/bash
# usage: runall.sh "list of scripts" logname
cd /home/user/BOM/usertest/mid/r12
for f in $1; do
  case $f in
    x1on) timeout 600 node x1.mjs on > out/x1on.out 2>&1;;
    x1reorder) timeout 600 node x1.mjs off reorder > out/x1-reorder.out 2>&1;;
    *) timeout 600 node $f.mjs > out/$f.out 2>&1;;
  esac
  o=$f; [ $f = x1reorder ] && o=x1-reorder
  echo "$f $(tail -1 out/$o.out)"
done
echo DONE
