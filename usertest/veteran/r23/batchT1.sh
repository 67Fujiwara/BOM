#!/bin/bash
# ラウンド23: r22 の vite-node スクリプトを現行(head)と r22 ビルド(r22b)で再実行
cd /home/user/BOM/usertest/veteran/r23
S=batchT1.status; : > $S
run() { # name script which [ENV...]
  local name=$1 script=$2 which=$3; shift 3
  echo "== $name $which $(date +%T) load=$(cut -d' ' -f1-3 /proc/loadavg)" >> $S
  ( for kv in "$@"; do export "$kv"; done; nice -n 8 ./probe.sh $script $which >> $S 2>&1 )
  local base=${script%.ts}; local suf=""; [ "$which" = r22b ] && suf="-r22b"
  [ -f $base$suf.log ] && mv $base$suf.log $name$suf.log
}
for w in head r22b; do
  run 230-delim-consistency 230-delim-consistency.ts $w
  run 195-delim-detect 195-delim-detect.ts $w
  run 176-delim-detect 176-delim-detect.ts $w
  run 241-kind-vocab 241-kind-vocab.ts $w
  run 233-parsetable-perf 233-parsetable-perf.ts $w
  for ks in default rfc rfc-noqc noml mlonly ml1; do
    for d in "," "\t"; do
      dd="$d"; [ "$d" = '\t' ] && dd=$'\t'
      dn=csv; [ "$d" = '\t' ] && dn=tsv
      run 260-fuzz-$ks-$dn 260-quote-fuzz.ts $w "DELIM=$dd" N=40000 KINDSET=$ks
    done
  done
  run 214-csv 214-raw-quote-small.ts $w DELIM=,
  run 214-tsv 214-raw-quote-small.ts $w "DELIM=$(printf '\t')"
  run 213-enum 213-raw-quote-enum.ts $w
  run 222-csv 222-quote-ml-enum.ts $w DELIM=,
  run 222-tsv 222-quote-ml-enum.ts $w "DELIM=$(printf '\t')"
done
echo done >> $S
