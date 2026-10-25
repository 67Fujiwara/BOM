#!/bin/bash
cd /home/user/BOM/usertest/veteran/r20
for m in csv tsv; do for sd in 11 12 13; do
 QUOTE=1 N=2000 SEED=$sd MODE=$m POOL=plain ./probe.sh 150-ordinary-fuzz.ts head
 QUOTE=1 N=2000 SEED=$sd MODE=$m POOL=plain ./probe.sh 150-ordinary-fuzz.ts r19b
done; done
echo done > batch2.status
