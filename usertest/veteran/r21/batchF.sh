#!/bin/bash
cd /home/user/BOM/usertest/veteran/r21
for pool in plain full; do
 for sd in 1 2; do
  for m in tsv csv; do
   N=1500 SEED=$sd MODE=$m POOL=$pool nice -n 8 ./probe.sh 150-ordinary-fuzz.ts head >> batchF.status
   N=1500 SEED=$sd MODE=$m POOL=$pool nice -n 8 ./probe.sh 150-ordinary-fuzz.ts r20b >> batchF.status
   QUOTE=1 N=2000 SEED=$sd MODE=$m POOL=$pool nice -n 8 ./probe.sh 150-ordinary-fuzz.ts head >> batchF.status
   QUOTE=1 N=2000 SEED=$sd MODE=$m POOL=$pool nice -n 8 ./probe.sh 150-ordinary-fuzz.ts r20b >> batchF.status
  done
  N=400 SEED=$sd MODE=xlsx POOL=$pool nice -n 8 ./probe.sh 150-ordinary-fuzz.ts head >> batchF.status
  N=400 SEED=$sd MODE=xlsx POOL=$pool nice -n 8 ./probe.sh 150-ordinary-fuzz.ts r20b >> batchF.status
 done
done
echo DONE >> batchF.status
