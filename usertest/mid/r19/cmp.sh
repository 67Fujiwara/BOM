#!/bin/bash
# r18 と r19 の FAIL 行（チェック名だけ）を比べる（m* はラウンド19 の新規）
cd /home/user/BOM/usertest/mid
for f in r19/out/*.out; do b=$(basename $f); case $b in *-run2.out|*-run3.out|m[0-9]*) continue;; esac
  [ -f r18/out/$b ] || { echo "NEW $b $(tail -1 $f)"; continue; }
  a=$(grep '^FAIL' r18/out/$b | sed 's/ :: .*//' | sort); c=$(grep '^FAIL' $f | sed 's/ :: .*//' | sort)
  t18=$(tail -1 r18/out/$b); t19=$(tail -1 $f)
  if [ "$a" != "$c" ]; then echo "DIFF $b r18[$t18] r19[$t19]"; diff <(echo "$a") <(echo "$c") | sed 's/^/   /'; fi
done
