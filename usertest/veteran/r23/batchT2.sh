#!/bin/bash
cd /home/user/BOM/usertest/veteran/r23
S=batchT2.status; : > $S
run() { local name=$1 script=$2 which=$3; shift 3
  echo "== $name $which $(date +%T) load=$(cut -d' ' -f1-3 /proc/loadavg)" >> $S
  ( for kv in "$@"; do export "$kv"; done; nice -n 8 ./probe.sh $script $which >> $S 2>&1 )
  local base=${script%.ts}; local suf=""; [ "$which" = r22b ] && suf="-r22b"
  [ -f $base$suf.log ] && mv $base$suf.log $name$suf.log
}
for w in head r22b; do
  run 180-redos-scan 180-redos-scan.ts $w NN=20000
  run 199-redos-scan2 199-redos-scan2.ts $w NN=20000
  run 220-redos-section 220-redos-section.ts $w
  run 242-redos-new 242-redos-new.ts $w NN=20000
  run 200-redos-delclass 200-redos-delclass.ts $w
  run 204-redos-cpu 204-redos-cpu.ts $w
  run 196-delclass 196-delclass.ts $w
  run 197-delparen 197-delparen.ts $w
  run 219-flag-volume 219-flag-volume.ts $w
  run 209-rowscale 209-rowscale.ts $w SIZES=2500,10000,40000
  run 172-parse-garbage 172-parse-garbage.ts $w
  run 216-xlsx-wide 216-xlsx-wide.ts $w
  run 206-titles 206-table-titles-commas.ts $w
  run 198-same-kind 198-same-kind-machines.ts $w
  run 232-delclass-phrases 232-delclass-phrases.ts $w
done
for pool in plain full; do for sd in 1 2; do for m in tsv csv; do
  for w in head r22b; do
    run 150-$pool-$m-$sd 150-ordinary-fuzz.ts $w N=1500 SEED=$sd MODE=$m POOL=$pool
    run 150-${pool}Q-$m-$sd 150-ordinary-fuzz.ts $w QUOTE=1 N=2000 SEED=$sd MODE=$m POOL=$pool
  done
done; for w in head r22b; do run 150-$pool-xlsx-$sd 150-ordinary-fuzz.ts $w N=400 SEED=$sd MODE=xlsx POOL=$pool; done; done; done
echo done >> $S
