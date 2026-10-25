#!/bin/bash
cd /home/user/BOM/usertest/veteran/r21
for s in 152-changesheet-truth.ts 175-threshold-grid.ts 160-bigchange-direct.ts 172-parse-garbage.ts 176-delim-detect.ts 165-xlsx-direct.ts; do
  nice -n 8 ./probe.sh $s head >> batchG.status
  nice -n 8 ./probe.sh $s r20b >> batchG.status
done
NOCHG=1 TAG=-nochg nice -n 8 ./probe.sh 152-changesheet-truth.ts head >> batchG.status
echo DONE >> batchG.status
