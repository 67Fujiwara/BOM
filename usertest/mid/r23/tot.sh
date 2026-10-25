#!/bin/bash
# 各ラウンドの out/*.out の最後の行「== a/b PASS」を頭文字ごとに合計する（run2・run3 は除く）。usage: tot.sh r20 / tot.sh r21
cd /home/user/BOM/usertest/mid/$1/out
for f in *.out; do case $f in *-run2.out|*-run3.out|f[123]-[0-9]*|q*) continue;; esac
  l=$(grep "^== " $f | tail -1); if [[ $l =~ ==\ ([0-9]+)/([0-9]+) ]]; then echo "${f:0:1} ${BASH_REMATCH[1]} ${BASH_REMATCH[2]}"; else echo "${f:0:1} 0 0 (no summary: $f)" >&2; fi
done | awk '{g=$1; if (g ~ /[vwxyz]/) g="v-z"; ok[g]+=$2; tot[g]+=$3} END {for (g in ok) printf "%s %d/%d\n", g, ok[g], tot[g]}' | sort
