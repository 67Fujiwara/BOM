#!/bin/bash
cd /home/user/BOM/usertest/veteran/r23
for s in 214-raw-quote-small.ts; do
  nice -n 8 ./probe.sh $s head >> batchE.status
  nice -n 8 ./probe.sh $s r21b >> batchE.status
  DELIM=$'\t' nice -n 8 ./probe.sh $s head >> batchE.status
  DELIM=$'\t' nice -n 8 ./probe.sh $s r21b >> batchE.status
done
for s in 180-redos-scan.ts 195-delim-detect.ts 176-delim-detect.ts 196-delclass.ts 197-delparen.ts 211-kind-false-positive.ts 209-rowscale.ts 172-parse-garbage.ts 199-redos-scan2.ts 216-xlsx-wide.ts 219-flag-volume.ts; do
  nice -n 8 ./probe.sh $s head >> batchE.status
  nice -n 8 ./probe.sh $s r21b >> batchE.status
done
echo DONE >> batchE.status
