#!/bin/bash
cd /home/user/BOM/usertest/veteran/r20
for s in 122-header-probe.ts 124b-big17-direct.ts 106-header-probe.ts 104-header-probe.ts 95-header-probe.ts 80-header-probe.ts r13-60-header-unit.ts 97b-xlsx-direct.ts 108b-xlsx-direct.ts 138-needoffset-range.ts; do
  nice -n 5 ./probe.sh $s head >> batchP2.status
  nice -n 5 ./probe.sh $s r19b >> batchP2.status
done
echo DONE >> batchP2.status
