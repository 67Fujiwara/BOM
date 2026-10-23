#!/bin/bash
cd /home/user/BOM/usertest/mid/r6
for f in v1 v2 v3 v4 v5 v6 v7 v8 v9 v10 v11 w1 w2 w3 w4 w5 w6 w7 w8 x2 x3 x4 x5 x6 x6b; do
  timeout 600 node $f.mjs > out/$f.out 2>&1
  echo "$f $(tail -1 out/$f.out)"
done
timeout 600 node x1.mjs on > out/x1on.out 2>&1; echo "x1on $(tail -1 out/x1on.out)"
