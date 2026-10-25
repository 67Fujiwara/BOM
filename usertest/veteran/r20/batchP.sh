#!/bin/bash
cd /home/user/BOM/usertest/veteran/r20
for s in 128-header-probe.ts 132b-big18-direct.ts 120-normalize-fuzz.ts 136-parse-time.ts; do
  nice -n 5 ./probe.sh $s head >> batchP.status
  nice -n 5 ./probe.sh $s r19b >> batchP.status
done
SEED=20 TAG=-s20 nice -n 5 ./probe.sh 131-render-fuzz.ts head >> batchP.status
SEED=20 nice -n 5 ./probe.sh 131-render-fuzz.ts r19b >> batchP.status
echo DONE >> batchP.status
