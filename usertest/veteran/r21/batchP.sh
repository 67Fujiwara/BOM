#!/bin/bash
cd /home/user/BOM/usertest/veteran/r21
nice -n 6 node 124-big17-make.mjs > 124-big17-make.log 2>&1
nice -n 6 node 132-big18-make.mjs > 132-big18-make.log 2>&1
nice -n 6 node 144-big19-make.mjs > 144-big19-make.log 2>&1
for s in 122-header-probe.ts 106-header-probe.ts 104-header-probe.ts 95-header-probe.ts 80-header-probe.ts r13-60-header-unit.ts 124b-big17-direct.ts 132b-big18-direct.ts 144b-big19-direct.ts 108b-xlsx-direct.ts 97b-xlsx-direct.ts 120-normalize-fuzz.ts; do
  nice -n 6 ./probe.sh $s head >> batchP.status
  nice -n 6 ./probe.sh $s r20b >> batchP.status
done
SEED=21 TAG=-s21 nice -n 6 ./probe.sh 131-render-fuzz.ts head >> batchP.status
SEED=21 TAG=-s21 nice -n 6 ./probe.sh 131-render-fuzz.ts r20b >> batchP.status
echo DONE >> batchP.status
