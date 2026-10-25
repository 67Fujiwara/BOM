#!/bin/bash
cd /home/user/BOM/usertest/veteran/r20
for m in tsv csv; do for sd in 1 2 3; do
 N=1500 SEED=$sd MODE=$m POOL=plain ./probe.sh 150-ordinary-fuzz.ts head
 N=1500 SEED=$sd MODE=$m POOL=plain ./probe.sh 150-ordinary-fuzz.ts r19b
done; done
for sd in 1 2; do
 N=400 SEED=$sd MODE=xlsx POOL=plain ./probe.sh 150-ordinary-fuzz.ts head
 N=400 SEED=$sd MODE=xlsx POOL=plain ./probe.sh 150-ordinary-fuzz.ts r19b
done
echo done > batch1.status
