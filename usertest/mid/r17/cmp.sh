#!/bin/bash
# r16 と r17 の FAIL 行（チェック名だけ）を比べる（k* はラウンド17 の新規）
cd /home/user/BOM/usertest/mid
for f in r17/out/*.out; do b=$(basename $f); case $b in *-run2.out|*-run3.out|k*) continue;; esac
  [ -f r16/out/$b ] || { echo "NEW $b $(tail -1 $f)"; continue; }
  a=$(grep '^FAIL' r16/out/$b | sed 's/ :: .*//' | sort); c=$(grep '^FAIL' $f | sed 's/ :: .*//' | sort)
  t16=$(tail -1 r16/out/$b); t17=$(tail -1 $f)
  if [ "$a" != "$c" ]; then echo "DIFF $b r16[$t16] r17[$t17]"; diff <(echo "$a") <(echo "$c") | sed 's/^/   /'; fi
done
