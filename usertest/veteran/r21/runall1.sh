#!/bin/bash
# round-20 header probes x 2 builds
cd /home/user/BOM/usertest/veteran/r21
for s in 150 156 166 177 140 128; do
  ./probe.sh $s-header-probe.ts head &
  ./probe.sh $s-header-probe.ts r20b &
  wait
done
