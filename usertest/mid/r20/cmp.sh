#!/bin/bash
# r19 と r20 の FAIL 行（チェック名だけ）を比べる（n* はラウンド20 の新規なので除く。m* はラウンド19 の新規で r19 にもある）
cd /home/user/BOM/usertest/mid
for f in r20/out/*.out; do b=$(basename $f); case $b in *-run2.out|*-run3.out|n[0-9]*) continue;; esac
  [ -f r19/out/$b ] || { echo "NEW $b $(grep '^== ' $f | tail -1)"; continue; }
  a=$(grep '^FAIL' r19/out/$b | sed 's/ :: .*//' | sort); c=$(grep '^FAIL' $f | sed 's/ :: .*//' | sort)
  t19=$(grep "^== " r19/out/$b | tail -1); t20=$(grep "^== " $f | tail -1)
  if [ "$a" != "$c" ]; then echo "DIFF $b r19[$t19] r20[$t20]"; diff <(echo "$a") <(echo "$c") | sed 's/^/   /'; fi
done
