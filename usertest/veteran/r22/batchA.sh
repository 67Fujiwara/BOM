#!/bin/bash
cd /home/user/BOM/usertest/veteran/r22
for n in 128 140 150 156 166 177 201; do
  ./probe.sh $n-header-probe.ts head
  ./probe.sh $n-header-probe.ts r21b
done
echo done > batchA.status
