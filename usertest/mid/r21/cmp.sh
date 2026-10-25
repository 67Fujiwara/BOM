#!/bin/bash
# r20 と r21 の FAIL 行（チェック名だけ）を比べる（n*・o* はそれぞれラウンド20・21 の新規なので除く）
cd /home/user/BOM/usertest/mid
for f in r21/out/*.out; do b=$(basename $f); case $b in *-run2.out|*-run3.out|n[0-9]*|o[0-9]*) continue;; esac
  [ -f r20/out/$b ] || { echo "NEW $b $(grep '^== ' $f | tail -1)"; continue; }
  a=$(grep '^FAIL' r20/out/$b | sed 's/ :: .*//' | sort); c=$(grep '^FAIL' $f | sed 's/ :: .*//' | sort)
  t20=$(grep "^== " r20/out/$b | tail -1); t21=$(grep "^== " $f | tail -1)
  if [ "$a" != "$c" ]; then echo "DIFF $b r20[$t20] r21[$t21]"; diff <(echo "$a") <(echo "$c") | sed 's/^/   /'; fi
done
