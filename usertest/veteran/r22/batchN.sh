#!/bin/bash
cd /home/user/BOM/usertest/veteran/r22
for b in head r21b; do
  nice -n 8 ./probe.sh 213-raw-quote-enum.ts $b >> batchN.status
  DELIM=, nice -n 8 ./probe.sh 222-quote-ml-enum.ts $b >> batchN.status
  DELIM=$'\t' nice -n 8 ./probe.sh 222-quote-ml-enum.ts $b >> batchN.status
done
echo DONE >> batchN.status
