#!/bin/bash
cd /home/user/BOM/usertest/newbie/r17
for s in "$@"; do
  echo "=== $s" 
  timeout 400 node $s.mjs > results/$s.stdout 2>&1; echo "exit $? $s"
done
